import { readFile } from "fs/promises";

type TocEntry = {
  title: string;
  position: number;
  locator: string;
};

type PdfTextLine = {
  text: string;
  page: number;
};

const MAX_TOC_SCAN_PAGES = 35;
const MAX_HEADING_SCAN_PAGES = 120;

function cleanLine(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[·•]{2,}/g, " ... ")
    .replace(/\.{2,}/g, " ... ")
    .trim();
}

function cleanTitle(value: string) {
  return cleanLine(value)
    .replace(/^[\d.]+\s*/, "")
    .replace(/^[一二三四五六七八九十百千万]+[、.]\s*/, "")
    .replace(/^[\s.·•…_-]+|[\s.·•…_-]+$/g, "")
    .trim();
}

function looksLikeUsefulTitle(value: string) {
  if (value.length < 2 || value.length > 90) return false;
  if (/^(目录|目\s*录|contents?)$/i.test(value)) return false;
  if (/^\d+$/.test(value)) return false;
  return /[\u4e00-\u9fa5A-Za-z]/.test(value);
}

function normalizeEntries(entries: Array<{ title: string; page: number }>, pageCount: number) {
  const seen = new Set<string>();
  const normalized: TocEntry[] = [];

  for (const entry of entries) {
    const title = cleanTitle(entry.title);
    const page = Math.max(1, Math.min(pageCount, Math.round(entry.page)));
    const key = `${title}:${page}`;

    if (!looksLikeUsefulTitle(title) || seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      title,
      position: normalized.length + 1,
      locator: String(page),
    });
  }

  return normalized.slice(0, 160);
}

async function resolveDestinationPage(pdf: any, destination: unknown) {
  const dest = typeof destination === "string" ? await pdf.getDestination(destination) : destination;
  if (!Array.isArray(dest) || !dest[0]) return null;
  return (await pdf.getPageIndex(dest[0])) + 1;
}

async function flattenOutline(pdf: any, items: any[], depth = 0): Promise<Array<{ title: string; page: number }>> {
  const entries: Array<{ title: string; page: number }> = [];

  for (const item of items) {
    try {
      const page = await resolveDestinationPage(pdf, item.dest);
      if (page) entries.push({ title: `${"　".repeat(depth)}${item.title || "未命名章节"}`, page });
    } catch {
      // Some PDFs contain broken destinations; skip that outline item.
    }

    if (Array.isArray(item.items) && item.items.length > 0) {
      entries.push(...(await flattenOutline(pdf, item.items, depth + 1)));
    }
  }

  return entries;
}

async function readPageLines(pdf: any, pageNumber: number): Promise<PdfTextLine[]> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const groups = new Map<number, Array<{ x: number; text: string }>>();

  for (const item of content.items as any[]) {
    const text = cleanLine(item.str || "");
    const transform = item.transform as number[] | undefined;
    if (!text || !transform) continue;

    const y = Math.round(transform[5] / 4) * 4;
    const x = Number(transform[4] || 0);
    const group = groups.get(y) ?? [];
    group.push({ x, text });
    groups.set(y, group);
  }

  return [...groups.entries()]
    .sort(([yA], [yB]) => yB - yA)
    .map(([, segments]) => ({
      page: pageNumber,
      text: cleanLine(segments.sort((a, b) => a.x - b.x).map((segment) => segment.text).join(" ")),
    }))
    .filter((line) => line.text.length > 0);
}

function parseTocLine(line: string, pageCount: number) {
  const text = cleanLine(line);
  const patterns = [
    /^(.{2,90}?)[\s.·•…_-]{2,}(\d{1,4})$/,
    /^((?:第[一二三四五六七八九十百千万零〇两\d]+[章节篇部卷].{0,70})|(?:\d+(?:\.\d+)+\s+.{2,70})|(?:[一二三四五六七八九十百千万]+[、.]\s*.{2,70}))\s+(\d{1,4})$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const page = Number.parseInt(match[2], 10);
    const title = cleanTitle(match[1]);
    if (Number.isFinite(page) && page >= 1 && page <= pageCount && looksLikeUsefulTitle(title)) {
      return { title, page };
    }
  }

  return null;
}

function parseTocPages(lines: PdfTextLine[], pageCount: number) {
  const entries: Array<{ title: string; page: number }> = [];
  let hasTocSignal = false;

  for (const line of lines) {
    if (/^(目录|目\s*录|contents?)$/i.test(line.text)) {
      hasTocSignal = true;
      continue;
    }

    const parsed = parseTocLine(line.text, pageCount);
    if (parsed) entries.push(parsed);
  }

  return hasTocSignal || entries.length >= 3 ? entries : [];
}

function parseHeadingLine(line: string) {
  const text = cleanLine(line);
  const patterns = [
    /^(第[一二三四五六七八九十百千万零〇两\d]+[章节篇部卷][\s:：、.-]*.{0,70})$/,
    /^(\d+(?:\.\d+)+\s+.{2,70})$/,
    /^(Chapter\s+\d+.{0,70})$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && looksLikeUsefulTitle(match[1])) return cleanTitle(match[1]);
  }

  return null;
}

async function scanHeadingPages(pdf: any, pageCount: number) {
  const entries: Array<{ title: string; page: number }> = [];
  const seen = new Set<string>();
  const maxPage = Math.min(pageCount, MAX_HEADING_SCAN_PAGES);

  for (let page = 1; page <= maxPage; page += 1) {
    const lines = await readPageLines(pdf, page);
    for (const line of lines.slice(0, 10)) {
      const title = parseHeadingLine(line.text);
      if (!title || seen.has(title)) continue;
      seen.add(title);
      entries.push({ title, page });
      break;
    }
  }

  return entries;
}

export async function extractPdfToc(filePath: string): Promise<TocEntry[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(filePath));
  const task = pdfjs.getDocument({
    data,
    disableWorker: true,
    disableFontFace: true,
    isEvalSupported: false,
  } as any);
  const pdf = await task.promise;
  const pageCount = pdf.numPages;

  const outline = await pdf.getOutline().catch(() => null);
  if (outline?.length) {
    const outlineEntries = normalizeEntries(await flattenOutline(pdf, outline), pageCount);
    if (outlineEntries.length) return outlineEntries;
  }

  const tocLines: PdfTextLine[] = [];
  for (let page = 1; page <= Math.min(pageCount, MAX_TOC_SCAN_PAGES); page += 1) {
    tocLines.push(...(await readPageLines(pdf, page)));
  }

  const parsedToc = normalizeEntries(parseTocPages(tocLines, pageCount), pageCount);
  if (parsedToc.length) return parsedToc;

  return normalizeEntries(await scanHeadingPages(pdf, pageCount), pageCount);
}
