"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/types/src/display/api";
import { createReadingRecordAction, deleteReadingRecordAction } from "@/app/actions";

pdfjs.GlobalWorkerOptions.workerSrc = "/assets/pdf.worker.min.mjs";

type Chapter = {
  id: string;
  title: string;
  position: number;
  locator: string | null;
};

type ReadingRecord = {
  id: string;
  kind: "NOTE" | "HIGHLIGHT" | "BOOKMARK" | "REFLECTION";
  body: string;
  quote: string | null;
  locator: string | null;
  pageNumber: number | null;
  annotationStyle: string | null;
  color: string | null;
  rects: string | null;
  user: {
    displayName: string;
  };
  parentRecordId: string | null;
  chapter: {
    title: string;
  } | null;
};

type PdfPageReaderProps = {
  bookId: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  uploaderName: string;
  fileUrl: string;
  returnTo: string;
  chapters: Chapter[];
  records: ReadingRecord[];
};

type TocEntry = {
  id: string;
  title: string;
  page: number;
  depth: number;
  source: "auto" | "manual";
};

type PageTextItem = {
  id: string;
  str: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
};

type AnnotationRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type SelectionState = {
  text: string;
  rects: AnnotationRect[];
};

type TextSelectionPoint = {
  itemIndex: number;
  charIndex: number;
  pageX: number;
  pageY: number;
  clientX: number;
  clientY: number;
};

type PageState = {
  bookmark: boolean;
  note: boolean;
  highlight: boolean;
  reflection: boolean;
};

type AnnotationView = {
  id: string;
  recordId: string;
  rect: AnnotationRect;
  color: string;
  style: "HIGHLIGHT" | "UNDERLINE";
  quote: string;
  body: string;
  userName: string;
};

type CommentDraft = {
  parentRecordId: string;
  quote: string;
  rects: AnnotationRect[];
  x: number;
  y: number;
  title: string;
};

const recordNames = {
  NOTE: "笔记",
  HIGHLIGHT: "勾画",
  BOOKMARK: "书签",
  REFLECTION: "心得",
} as const;

const markColors = [
  "#ffd400",
  "#ff6666",
  "#5fb236",
  "#2ea8e5",
  "#a28ae5",
  "#e56be7",
  "#f19837",
  "#aaaaaa",
];

function pageLocator(page: number) {
  return `第 ${page} 页`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function safePage(value: number, pageCount: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  if (!pageCount) return Math.max(1, Math.round(value));
  return clamp(Math.round(value), 1, pageCount);
}

function chapterPage(chapter: Chapter) {
  const fromLocator = Number.parseInt(chapter.locator || "", 10);
  if (Number.isFinite(fromLocator)) return Math.max(1, fromLocator);
  return Math.max(1, chapter.position);
}

function recordPageNumber(record: ReadingRecord) {
  if (typeof record.pageNumber === "number" && Number.isFinite(record.pageNumber)) {
    return record.pageNumber;
  }
  const match = record.locator?.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

function recordsForPage(records: ReadingRecord[], page: number) {
  return records.filter((record) => recordPageNumber(record) === page || record.locator === pageLocator(page));
}

function recordText(record: ReadingRecord) {
  return (record.quote || record.body).replace(/^(高亮|划线|书签|批注)：\s*/, "");
}

function recordBodyText(record: ReadingRecord) {
  return record.body.replace(/^(高亮|划线|书签|批注)：\s*/, "");
}

function parseRects(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as AnnotationRect[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((rect) =>
        Number.isFinite(rect.left) &&
        Number.isFinite(rect.top) &&
        Number.isFinite(rect.width) &&
        Number.isFinite(rect.height),
      )
      .map((rect) => ({
        left: clamp(rect.left, 0, 1),
        top: clamp(rect.top, 0, 1),
        width: clamp(rect.width, 0, 1),
        height: clamp(rect.height, 0, 1),
      }));
  } catch {
    return [];
  }
}

function rectStyle(rect: AnnotationRect) {
  return {
    left: `${rect.left * 100}%`,
    top: `${rect.top * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  };
}

function buildManualToc(chapters: Chapter[]): TocEntry[] {
  return chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    page: chapterPage(chapter),
    depth: 0,
    source: "manual",
  }));
}

async function flattenPdfOutline(
  pdf: PDFDocumentProxy,
  items: unknown[],
  depth = 0,
  prefix = "",
): Promise<TocEntry[]> {
  const entries: TocEntry[] = [];

  for (const [index, item] of items.entries()) {
    const outlineItem = item as {
      title?: string;
      dest?: string | unknown[];
      items?: unknown[];
    };
    const id = `${prefix}${index}`;
    let page = 1;

    try {
      const destination =
        typeof outlineItem.dest === "string"
          ? await pdf.getDestination(outlineItem.dest)
          : outlineItem.dest;

      if (Array.isArray(destination) && destination[0]) {
        page = (await pdf.getPageIndex(destination[0])) + 1;
      }
    } catch {
      page = 1;
    }

    entries.push({
      id,
      title: outlineItem.title || "未命名章节",
      page,
      depth,
      source: "auto",
    });

    if (Array.isArray(outlineItem.items) && outlineItem.items.length > 0) {
      entries.push(...(await flattenPdfOutline(pdf, outlineItem.items, depth + 1, `${id}-`)));
    }
  }

  return entries;
}

function buildPageStates(records: ReadingRecord[]) {
  const map = new Map<number, PageState>();

  for (const record of records) {
    const page = recordPageNumber(record);
    if (!page) continue;
    const state = map.get(page) ?? {
      bookmark: false,
      note: false,
      highlight: false,
      reflection: false,
    };

    if (record.kind === "BOOKMARK") state.bookmark = true;
    if (record.kind === "NOTE") state.note = true;
    if (record.kind === "HIGHLIGHT") state.highlight = true;
    if (record.kind === "REFLECTION") state.reflection = true;

    map.set(page, state);
  }

  return map;
}

function PdfThumbnail({
  pdf,
  pageNumber,
  active,
  state,
  onGo,
}: {
  pdf: PDFDocumentProxy | null;
  pageNumber: number;
  active: boolean;
  state?: PageState;
  onGo: (page: number) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const root = button.closest(".reader-preview-list");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root, rootMargin: "360px" },
    );

    observer.observe(button);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !pdf || !canvasRef.current) return;

    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;

    pdf.getPage(pageNumber)
      .then((pdfPage) => {
        if (cancelled || !canvasRef.current) return;

        const viewport = pdfPage.getViewport({ scale: 0.16 });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        task = pdfPage.render({ canvas, canvasContext: context, viewport });
        task.promise.catch(() => undefined);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, visible]);

  return (
    <button
      ref={buttonRef}
      className={active ? "reader-preview-item is-active" : "reader-preview-item"}
      type="button"
      onClick={() => onGo(pageNumber)}
      aria-label={`打开第 ${pageNumber} 页`}
    >
      <span className="reader-preview-canvas">
        <canvas ref={canvasRef} />
        {!visible ? <span>{pageNumber}</span> : null}
      </span>
      <span className="reader-preview-meta">
        <strong>{pageNumber}</strong>
        <span className="reader-page-flags" aria-label="页面记录状态">
          {state?.bookmark ? <i className="flag-bookmark" title="有书签" /> : null}
          {state?.note || state?.reflection ? <i className="flag-note" title="有笔记/心得" /> : null}
          {state?.highlight ? <i className="flag-highlight" title="有勾画" /> : null}
        </span>
      </span>
    </button>
  );
}

export function PdfPageReader({
  bookId,
  title,
  author,
  coverUrl,
  uploaderName,
  fileUrl,
  returnTo,
  chapters,
  records,
}: PdfPageReaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageFrameRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const highlightFormRef = useRef<HTMLFormElement>(null);
  const underlineFormRef = useRef<HTMLFormElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [scale, setScale] = useState(1.18);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [autoToc, setAutoToc] = useState<TocEntry[]>([]);
  const [activeDock, setActiveDock] = useState<"preview" | "toc" | "records" | "bookmarks">("preview");
  const [textItems, setTextItems] = useState<PageTextItem[]>([]);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [selected, setSelected] = useState<SelectionState | null>(null);
  const [selectionStart, setSelectionStart] = useState<TextSelectionPoint | null>(null);
  const [markStyle, setMarkStyle] = useState<"HIGHLIGHT" | "UNDERLINE">("HIGHLIGHT");
  const [commentDraft, setCommentDraft] = useState<CommentDraft | null>(null);
  const [markColor, setMarkColor] = useState("#f0d45a");

  const pageCount = pdf?.numPages ?? 0;
  const manualToc = useMemo(() => buildManualToc(chapters), [chapters]);
  const tocEntries = useMemo(() => {
    const entries = autoToc.length ? autoToc : manualToc;
    return entries.filter((entry) => entry.page > 0 && (!pageCount || entry.page <= pageCount));
  }, [autoToc, manualToc, pageCount]);
  const pageNumbers = useMemo(
    () => Array.from({ length: pageCount }, (_, index) => index + 1),
    [pageCount],
  );
  const pageStates = useMemo(() => buildPageStates(records), [records]);
  const currentRecords = useMemo(() => recordsForPage(records, page), [records, page]);
  const allTopLevelRecords = useMemo(() => records.filter((record) => !record.parentRecordId), [records]);
  const currentTopLevelRecords = useMemo(
    () => currentRecords.filter((record) => !record.parentRecordId),
    [currentRecords],
  );
  const currentStoredChapter = useMemo(() => {
    if (!chapters.length) return null;
    return [...chapters].reverse().find((chapter) => chapterPage(chapter) <= page) ?? chapters[0];
  }, [chapters, page]);
  const currentChapter = useMemo(() => {
    if (!tocEntries.length) return null;
    return [...tocEntries].reverse().find((entry) => entry.page <= page) ?? tocEntries[0];
  }, [tocEntries, page]);
  const commentsByParent = useMemo(() => {
    const map = new Map<string, ReadingRecord[]>();
    for (const record of currentRecords) {
      if (!record.parentRecordId) continue;
      const comments = map.get(record.parentRecordId) ?? [];
      comments.push(record);
      map.set(record.parentRecordId, comments);
    }
    return map;
  }, [currentRecords]);
  const currentAnnotations = useMemo(
    () =>
      currentRecords
        .filter(
          (record) =>
            record.kind === "HIGHLIGHT" &&
            (record.annotationStyle === "HIGHLIGHT" || record.annotationStyle === "UNDERLINE"),
        )
        .flatMap((record) =>
        parseRects(record.rects).map((rect, index): AnnotationView => ({
          id: `${record.id}-${index}`,
          recordId: record.id,
          rect,
          color: record.color || "#f0d45a",
          style: record.annotationStyle === "UNDERLINE" ? "UNDERLINE" : "HIGHLIGHT",
          quote: record.quote || "",
          body: record.body,
          userName: record.user.displayName,
        })),
      ),
    [currentRecords],
  );
  const activeAnnotationComments =
    commentDraft?.parentRecordId ? commentsByParent.get(commentDraft.parentRecordId) ?? [] : [];
  const currentReturnTo = `${returnTo}?page=${page}`;

  function recordIcon(record: ReadingRecord) {
    if (record.kind === "BOOKMARK") return "B";
    if (record.annotationStyle === "UNDERLINE") return "U";
    return "A";
  }

  function DeleteRecordButton({ recordId }: { recordId: string }) {
    return (
      <form action={deleteReadingRecordAction} className="record-delete-form">
        <input type="hidden" name="recordId" value={recordId} />
        <input type="hidden" name="returnTo" value={currentReturnTo} />
        <button type="submit" title="删除记录" aria-label="删除记录">
          删除
        </button>
      </form>
    );
  }

  function goToPage(nextPage: number) {
    const target = safePage(nextPage, pageCount, page);
    setPage(target);
    setPageInput(String(target));
  }

  function captureSelection() {
    const selection = window.getSelection();
    const textLayer = textLayerRef.current;
    if (!selection || selection.isCollapsed || !textLayer) return;

    const text = selection.toString().replace(/\s+/g, " ").trim();
    if (!text) return;
    if (!textLayer.contains(selection.getRangeAt(0).commonAncestorContainer)) return;

    const layerRect = textLayer.getBoundingClientRect();
    const rects: AnnotationRect[] = [];

    for (let index = 0; index < selection.rangeCount; index += 1) {
      const range = selection.getRangeAt(index);
      for (const clientRect of Array.from(range.getClientRects())) {
        const left = (clientRect.left - layerRect.left) / layerRect.width;
        const top = (clientRect.top - layerRect.top) / layerRect.height;
        const width = clientRect.width / layerRect.width;
        const height = clientRect.height / layerRect.height;

        if (width > 0.001 && height > 0.001) {
          rects.push({
            left: clamp(left, 0, 1),
            top: clamp(top, 0, 1),
            width: clamp(width, 0, 1),
            height: clamp(height, 0, 1),
          });
        }
      }
    }

    if (rects.length) {
      setSelected({ text, rects: rects.slice(0, 80) });
      selection.removeAllRanges();
    }
  }

  function finishNativeTextSelection() {
    window.setTimeout(captureSelection, 0);
  }

  function textItemRect(item: PageTextItem): AnnotationRect {
    return {
      left: clamp(item.left / pageSize.width, 0, 1),
      top: clamp(item.top / pageSize.height, 0, 1),
      width: clamp(item.width / pageSize.width, 0, 1),
      height: clamp(item.height / pageSize.height, 0, 1),
    };
  }

  function textSliceRect(item: PageTextItem, startChar: number, endChar: number): AnnotationRect {
    const charCount = Math.max(Array.from(item.str).length, 1);
    const startRatio = clamp(startChar / charCount, 0, 1);
    const endRatio = clamp(endChar / charCount, 0, 1);

    return {
      left: clamp((item.left + item.width * startRatio) / pageSize.width, 0, 1),
      top: clamp(item.top / pageSize.height, 0, 1),
      width: clamp((item.width * Math.max(endRatio - startRatio, 0)) / pageSize.width, 0, 1),
      height: clamp(item.height / pageSize.height, 0, 1),
    };
  }

  function textElementAtPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const direct = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-text-index]");
    if (direct) return direct;

    const layer = textLayerRef.current;
    if (!layer) return null;

    return (
      Array.from(layer.querySelectorAll<HTMLElement>("[data-text-index]")).find((element) => {
        const rect = element.getBoundingClientRect();
        return (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        );
      }) ?? null
    );
  }

  function textPointFromPointer(event: ReactPointerEvent<HTMLDivElement>): TextSelectionPoint | null {
    const element = textElementAtPointer(event);
    if (!element) return null;
    const index = element.dataset.textIndex;
    if (index == null) return null;

    const itemIndex = Number.parseInt(index, 10);
    const item = textItems[itemIndex];
    if (!Number.isFinite(itemIndex) || !item) return null;

    const rect = element.getBoundingClientRect();
    const charCount = Array.from(item.str).length;
    const ratio = rect.width ? clamp((event.clientX - rect.left) / rect.width, 0, 1) : 0;
    const charIndex = clamp(Math.round(ratio * charCount), 0, charCount);

    return {
      itemIndex,
      charIndex,
      pageX: item.left + item.width * (charCount ? charIndex / charCount : 0),
      pageY: item.top + item.height / 2,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }

  function pointComesAfter(a: TextSelectionPoint, b: TextSelectionPoint) {
    const rowTolerance = Math.max(textItems[a.itemIndex]?.fontSize || 10, textItems[b.itemIndex]?.fontSize || 10) * 0.8;
    if (Math.abs(a.pageY - b.pageY) > rowTolerance) return a.pageY > b.pageY;
    return a.pageX > b.pageX;
  }

  function selectTextPointRange(startPoint: TextSelectionPoint, endPoint: TextSelectionPoint) {
    if (!pageSize.width || !pageSize.height) return;

    const distance = Math.hypot(endPoint.clientX - startPoint.clientX, endPoint.clientY - startPoint.clientY);
    const sameCaret =
      startPoint.itemIndex === endPoint.itemIndex && startPoint.charIndex === endPoint.charIndex;
    if (distance < 5 && sameCaret) {
      setSelected(null);
      return;
    }

    const [start, end] = pointComesAfter(startPoint, endPoint)
      ? [endPoint, startPoint]
      : [startPoint, endPoint];
    const startItem = textItems[start.itemIndex];
    const endItem = textItems[end.itemIndex];
    if (!startItem || !endItem) return;

    const rowTolerance = Math.max(startItem.fontSize, endItem.fontSize, 10) * 0.9;
    const sameRow = Math.abs(start.pageY - end.pageY) <= rowTolerance;
    const selectedItems: Array<{ text: string; rect: AnnotationRect }> = [];

    const appendSlice = (item: PageTextItem, fromX: number, toX: number) => {
      const chars = Array.from(item.str);
      if (!chars.length) return;

      const itemLeft = item.left;
      const itemRight = item.left + item.width;
      const overlapStart = clamp(Math.max(itemLeft, fromX), itemLeft, itemRight);
      const overlapEnd = clamp(Math.min(itemRight, toX), itemLeft, itemRight);
      if (overlapEnd <= overlapStart) return;

      const startChar = clamp(Math.floor(((overlapStart - itemLeft) / Math.max(item.width, 1)) * chars.length), 0, chars.length);
      const endChar = clamp(Math.ceil(((overlapEnd - itemLeft) / Math.max(item.width, 1)) * chars.length), 0, chars.length);
      if (endChar <= startChar) return;

      const text = chars.slice(startChar, endChar).join("");
      if (!text.trim()) return;

      const rect = textSliceRect(item, startChar, endChar);
      if (rect.width <= 0.001 || rect.height <= 0.001) return;
      selectedItems.push({ text, rect });
    };

    if (sameRow) {
      const rowY = (start.pageY + end.pageY) / 2;
      const fromX = Math.min(start.pageX, end.pageX);
      const toX = Math.max(start.pageX, end.pageX);

      textItems
        .filter((item) => Math.abs(item.top + item.height / 2 - rowY) <= rowTolerance)
        .sort((a, b) => a.left - b.left)
        .forEach((item) => appendSlice(item, fromX, toX));
    } else {
      const startY = start.pageY;
      const endY = end.pageY;

      textItems
        .filter((item) => {
          const itemY = item.top + item.height / 2;
          return itemY >= startY - rowTolerance && itemY <= endY + rowTolerance;
        })
        .sort((a, b) => {
          const lineTolerance = Math.max(a.fontSize, b.fontSize) * 0.55;
          if (Math.abs(a.top - b.top) > lineTolerance) return a.top - b.top;
          return a.left - b.left;
        })
        .forEach((item) => {
          const itemY = item.top + item.height / 2;
          const isStartRow = Math.abs(itemY - startY) <= rowTolerance;
          const isEndRow = Math.abs(itemY - endY) <= rowTolerance;
          const fromX = isStartRow ? start.pageX : 0;
          const toX = isEndRow ? end.pageX : pageSize.width;
          appendSlice(item, fromX, toX);
        });
    }

    if (!selectedItems.length) return;

    setSelected({
      text: selectedItems.map(({ text }) => text).join("").replace(/\s+/g, " ").trim(),
      rects: selectedItems.map(({ rect }) => rect).slice(0, 80),
    });
  }

  function beginTextSelection(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const point = textPointFromPointer(event);
    if (!point) return;

    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    setSelected(null);
    setCommentDraft(null);
    setSelectionStart(point);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateTextSelection(event: ReactPointerEvent<HTMLDivElement>) {
    if (!selectionStart) return;
    const point = textPointFromPointer(event);
    if (!point) return;
    event.preventDefault();
    selectTextPointRange(selectionStart, point);
  }

  function finishTextSelection(event: ReactPointerEvent<HTMLDivElement>) {
    if (!selectionStart) {
      finishNativeTextSelection();
      return;
    }

    const point = textPointFromPointer(event);
    if (point) selectTextPointRange(selectionStart, point);

    setSelectionStart(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function selectionAnchor(rects: AnnotationRect[]) {
    const first = rects[0];
    if (!first) return { x: 0.5, y: 0.18 };
    return {
      x: clamp(first.left + first.width / 2, 0.08, 0.92),
      y: clamp(first.top - 0.035, 0.04, 0.88),
    };
  }

  function submitSelectedMark(style: "HIGHLIGHT" | "UNDERLINE" = markStyle) {
    if (!selected) return;
    if (style === "HIGHLIGHT") {
      highlightFormRef.current?.requestSubmit();
    } else {
      underlineFormRef.current?.requestSubmit();
    }
  }

  function openCommentForSelection() {
    if (!selected) return;
    const anchor = selectionAnchor(selected.rects);
    setCommentDraft({
      parentRecordId: "",
      quote: selected.text,
      rects: selected.rects,
      x: anchor.x,
      y: anchor.y,
      title: "评论选区",
    });
  }

  function openPageNote() {
    if (selected) {
      openCommentForSelection();
      return;
    }

    setCommentDraft({
      parentRecordId: "",
      quote: "",
      rects: [],
      x: 0.58,
      y: 0.2,
      title: "本页笔记",
    });
  }

  function openCommentForAnnotation(annotation: AnnotationView, event: ReactMouseEvent<HTMLSpanElement>) {
    event.preventDefault();
    const frame = pageFrameRef.current;
    if (!frame) return;
    const frameRect = frame.getBoundingClientRect();

    setSelected(null);
    setCommentDraft({
      parentRecordId: annotation.recordId,
      quote: annotation.quote,
      rects: [annotation.rect],
      x: clamp((event.clientX - frameRect.left) / frameRect.width, 0.08, 0.92),
      y: clamp((event.clientY - frameRect.top) / frameRect.height, 0.04, 0.88),
      title: `${annotation.style === "UNDERLINE" ? "划线" : "高亮"}评论`,
    });
  }

  useEffect(() => {
    const requestedPage = Number.parseInt(new URLSearchParams(window.location.search).get("page") || "", 10);
    if (Number.isFinite(requestedPage) && requestedPage > 0) {
      setPage(requestedPage);
      setPageInput(String(requestedPage));
    }
  }, []);

  useEffect(() => {
    if (pageCount && page > pageCount) {
      goToPage(pageCount);
    }
  }, [page, pageCount]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setAutoToc([]);

    pdfjs
      .getDocument({ url: fileUrl })
      .promise.then((document) => {
        if (cancelled) return;
        setPdf(document);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("PDF 加载失败。");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;

    pdf
      .getOutline()
      .then(async (outline) => {
        if (cancelled || !outline?.length) {
          if (!cancelled) setAutoToc([]);
          return;
        }
        const entries = await flattenPdfOutline(pdf, outline);
        if (!cancelled) setAutoToc(entries.filter((entry) => entry.page > 0));
      })
      .catch(() => {
        if (!cancelled) setAutoToc([]);
      });

    return () => {
      cancelled = true;
    };
  }, [pdf]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    setRendering(true);
    setSelected(null);
    setCommentDraft(null);
    setSelectionStart(null);
    setTextItems([]);
    renderTaskRef.current?.cancel();

    pdf
      .getPage(page)
      .then((pdfPage: PDFPageProxy) => {
        if (cancelled || !canvasRef.current) return;

        const viewport = pdfPage.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        setPageSize({ width: viewport.width, height: viewport.height });

        const task = pdfPage.render({ canvas, canvasContext: context, viewport });
        renderTaskRef.current = task;

        pdfPage
          .getTextContent()
          .then((content) => {
            if (cancelled) return;
            const transformUtil = (pdfjs as unknown as { Util: { transform: (a: number[], b: number[]) => number[] } }).Util;
            const nextItems = (content.items as unknown[])
              .map((item, index) => {
                const textItem = item as {
                  str?: string;
                  transform?: number[];
                  width?: number;
                  height?: number;
                };
                if (!textItem.str || !textItem.transform) return null;

                const transformed = transformUtil.transform(viewport.transform, textItem.transform);
                const fontSize = Math.max(5, Math.hypot(transformed[2], transformed[3]));
                const width = Math.max(2, (textItem.width || textItem.str.length * fontSize * 0.52) * scale);
                const height = Math.max(fontSize, (textItem.height || fontSize) * scale);

                return {
                  id: `${page}-${index}`,
                  str: textItem.str,
                  left: transformed[4],
                  top: transformed[5] - fontSize,
                  width,
                  height,
                  fontSize,
                };
              })
              .filter((item): item is PageTextItem => Boolean(item));

            const orderedItems = [...nextItems].sort((a, b) => {
              const lineTolerance = Math.max(a.fontSize, b.fontSize) * 0.55;
              if (Math.abs(a.top - b.top) > lineTolerance) return a.top - b.top;
              return a.left - b.left;
            });

            setTextItems(orderedItems);
          })
          .catch(() => {
            if (!cancelled) setTextItems([]);
          });

        task.promise
          .catch((renderError) => {
            if (renderError?.name !== "RenderingCancelledException") {
              setError("页面渲染失败。");
            }
          })
          .finally(() => {
            if (!cancelled) setRendering(false);
          });
      })
      .catch(() => {
        if (!cancelled) {
          setError("页面渲染失败。");
          setRendering(false);
        }
      });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pdf, page, scale]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPage(page - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToPage(page + 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="immersive-reader">
      <header className="immersive-reader-topbar">
        <div className="zotero-tab-row">
          <a className="zotero-library-link" href="/guandaoguan">
            <span>□</span>
            观道观
          </a>
          <div className="zotero-document-tab">
            <span className="reader-mini-cover">
              {coverUrl ? <img src={coverUrl} alt="" /> : title.slice(0, 2)}
            </span>
            <strong>{title}</strong>
            <small>{author || "佚名"} · {uploaderName}</small>
          </div>
        </div>

        <div className="zotero-toolbar-row">
          <div className="zotero-tool-group">
            <button className="zotero-tool-button" type="button" aria-label="页面缩略图" onClick={() => setActiveDock("preview")}>
              ▦
            </button>
            <button className="zotero-tool-button" type="button" aria-label="记录列表" onClick={() => setActiveDock("records")}>
              ☰
            </button>
            <button className="zotero-tool-button" type="button" aria-label="目录" onClick={() => setActiveDock("toc")}>
              ≡
            </button>
          </div>

          <div className="zotero-tool-group">
            <button className="zotero-tool-button" type="button" onClick={() => setScale((value) => Math.max(0.72, value - 0.1))}>
              −
            </button>
            <button className="zotero-tool-button" type="button" onClick={() => setScale((value) => Math.min(2.05, value + 0.1))}>
              ＋
            </button>
            <span className="zotero-zoom-label">{Math.round(scale * 100)}%</span>
          </div>

          <div className="zotero-tool-group">
            <button className="zotero-tool-button" type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
              ↑
            </button>
            <button className="zotero-tool-button" type="button" onClick={() => goToPage(page + 1)} disabled={!pageCount || page >= pageCount}>
              ↓
            </button>
            <form
              className="reader-page-jump"
              onSubmit={(event) => {
                event.preventDefault();
                goToPage(Number(pageInput));
              }}
            >
              <input
                aria-label="页码"
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
              />
              <span>/ {pageCount || "-"}</span>
            </form>
          </div>

          <span className="zotero-toolbar-spacer" />

          <div className="zotero-tool-group zotero-annotation-tools">
            <button
              className={markStyle === "HIGHLIGHT" ? "zotero-tool-button is-active" : "zotero-tool-button"}
              type="button"
              title="高亮"
              disabled={!selected}
              onClick={() => {
                setMarkStyle("HIGHLIGHT");
                submitSelectedMark("HIGHLIGHT");
              }}
            >
              A
            </button>
            <button
              className={markStyle === "UNDERLINE" ? "zotero-tool-button is-active underline-tool" : "zotero-tool-button underline-tool"}
              type="button"
              title="划线"
              disabled={!selected}
              onClick={() => {
                setMarkStyle("UNDERLINE");
                submitSelectedMark("UNDERLINE");
              }}
            >
              A
            </button>
            <button className="zotero-tool-button" type="button" title="笔记" onClick={openPageNote}>
              ◰
            </button>
            <form action={createReadingRecordAction}>
              <input type="hidden" name="bookId" value={bookId} />
              <input type="hidden" name="returnTo" value={currentReturnTo} />
              <input type="hidden" name="chapterId" value={currentStoredChapter?.id || ""} />
              <input type="hidden" name="locator" value={pageLocator(page)} />
              <input type="hidden" name="pageNumber" value={page} />
              <input type="hidden" name="kind" value="BOOKMARK" />
              <input type="hidden" name="body" value={pageLocator(page)} />
              <button className="zotero-tool-button bookmark-tool" type="submit" title="添加书签">
                ▮
              </button>
            </form>
            <a className="zotero-tool-button" href={`${fileUrl}#page=${page}`} target="_blank" rel="noreferrer" title="打开原文件">
              PDF
            </a>
          </div>
        </div>
      </header>

      <div className="reader-workspace">
        <aside className="reader-left-dock zotero-left-sidebar">
          <div className="zotero-sidebar-icons" aria-label="阅读器边栏">
            <button className={activeDock === "preview" ? "is-active" : ""} type="button" onClick={() => setActiveDock("preview")} title="缩略图">
              ▦
            </button>
            <button className={activeDock === "records" ? "is-active" : ""} type="button" onClick={() => setActiveDock("records")} title="记录">
              ▱
            </button>
            <button className={activeDock === "toc" ? "is-active" : ""} type="button" onClick={() => setActiveDock("toc")} title="目录">
              ☰
            </button>
            <button className={activeDock === "bookmarks" ? "is-active" : ""} type="button" onClick={() => setActiveDock("bookmarks")} title="书签">
              ▮
            </button>
          </div>

          <div className="zotero-sidebar-content">
            {activeDock === "preview" ? (
              <div className="reader-preview-list" aria-label="页面预览">
                {pageNumbers.map((pageNumber) => (
                  <PdfThumbnail
                    key={pageNumber}
                    pdf={pdf}
                    pageNumber={pageNumber}
                    active={pageNumber === page}
                    state={pageStates.get(pageNumber)}
                    onGo={goToPage}
                  />
                ))}
                {!pageNumbers.length ? <p className="muted">正在生成页览...</p> : null}
              </div>
            ) : null}

            {activeDock === "records" ? (
              <div className="zotero-annotation-list" aria-label="全部记录">
                {allTopLevelRecords.length === 0 ? <p className="muted">暂无记录。</p> : null}
                {allTopLevelRecords.map((record) => (
                  <button key={record.id} type="button" onClick={() => recordPageNumber(record) ? goToPage(recordPageNumber(record) || page) : undefined}>
                    <span className={`record-type-dot type-${record.kind.toLowerCase()}`}>{recordIcon(record)}</span>
                    <strong>{record.locator || "整本书"}</strong>
                    <small>{recordText(record)}</small>
                  </button>
                ))}
              </div>
            ) : null}

            {activeDock === "toc" ? (
              <div className="reader-toc-list" aria-label="自动目录">
                <p className="toc-source">
                  {autoToc.length ? "已读取 PDF 内置目录" : "未检测到内置目录，显示上传时录入的目录"}
                </p>
                {tocEntries.length === 0 ? <p className="muted">暂未识别到目录。</p> : null}
                {tocEntries.map((entry) => (
                  <button
                    key={`${entry.source}-${entry.id}`}
                    type="button"
                    onClick={() => goToPage(entry.page)}
                    style={{ paddingLeft: `${10 + entry.depth * 14}px` }}
                  >
                    <span>{entry.page}</span>
                    {entry.title}
                  </button>
                ))}
              </div>
            ) : null}

            {activeDock === "bookmarks" ? (
              <div className="zotero-annotation-list" aria-label="书签">
                {allTopLevelRecords.filter((record) => record.kind === "BOOKMARK").length === 0 ? <p className="muted">暂无书签。</p> : null}
                {allTopLevelRecords.filter((record) => record.kind === "BOOKMARK").map((record) => (
                  <button key={record.id} type="button" onClick={() => recordPageNumber(record) ? goToPage(recordPageNumber(record) || page) : undefined}>
                    <span className="record-type-dot type-bookmark">{recordIcon(record)}</span>
                    <strong>{record.locator || "整本书"}</strong>
                    <small>{recordText(record)}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </aside>

        <main className="reader-sheet" aria-label="书页阅读区">
          <div className="reader-sheet-label">
            <strong>{currentChapter?.title || "整本书"}</strong>
            <span>{pageLocator(page)}</span>
          </div>
          <div className="reader-page-scroll">
            {loading ? <p className="muted">正在打开 PDF...</p> : null}
            {error ? <p className="error">{error}</p> : null}
            <div
              ref={pageFrameRef}
              className={rendering ? "pdf-page-frame is-rendering" : "pdf-page-frame"}
              style={pageSize.width ? { width: pageSize.width, height: pageSize.height } : undefined}
            >
              <canvas ref={canvasRef} className="pdf-page-canvas" />
              <div className="annotation-layer">
                {currentAnnotations.map((annotation) => (
                  <span
                    key={annotation.id}
                    className={
                      annotation.style === "UNDERLINE"
                        ? "saved-annotation is-underline"
                        : "saved-annotation is-highlight"
                    }
                    onClick={(event) => openCommentForAnnotation(annotation, event)}
                    onContextMenu={(event) => openCommentForAnnotation(annotation, event)}
                    title="点击添加评论"
                    style={{ ...rectStyle(annotation.rect), "--mark-color": annotation.color } as CSSProperties}
                  />
                ))}
                {selected?.rects.map((rect, index) => (
                  <span
                    key={`selected-${index}`}
                    className="selection-annotation"
                    style={{ ...rectStyle(rect), "--mark-color": markColor } as CSSProperties}
                  />
                ))}
                {selected ? (
                  <div
                    className="reader-selection-toolbar"
                    style={{
                      left: `${selectionAnchor(selected.rects).x * 100}%`,
                      top: `${selectionAnchor(selected.rects).y * 100}%`,
                    }}
                  >
                    <div className="zotero-color-row">
                      {markColors.map((color) => (
                        <button
                          key={color}
                          className={markColor === color ? "is-active" : ""}
                          type="button"
                          onClick={() => setMarkColor(color)}
                          style={{ "--mark-color": color } as CSSProperties}
                          aria-label={`选择颜色 ${color}`}
                        />
                      ))}
                    </div>
                    <div className="zotero-selection-actions">
                      <button type="button" onClick={() => submitSelectedMark("HIGHLIGHT")}>
                        A
                      </button>
                      <button className="underline-tool" type="button" onClick={() => submitSelectedMark("UNDERLINE")}>
                        A
                      </button>
                      <button type="button" onClick={openCommentForSelection}>
                        评论
                      </button>
                    </div>
                  </div>
                ) : null}
                {commentDraft ? (
                  <form
                    action={createReadingRecordAction}
                    className="annotation-comment-popover"
                    style={{
                      left: `${commentDraft.x * 100}%`,
                      top: `${commentDraft.y * 100}%`,
                    }}
                  >
                    <input type="hidden" name="bookId" value={bookId} />
                    <input type="hidden" name="returnTo" value={currentReturnTo} />
                    <input type="hidden" name="chapterId" value={currentStoredChapter?.id || ""} />
                    <input type="hidden" name="parentRecordId" value={commentDraft.parentRecordId} />
                    <input type="hidden" name="locator" value={pageLocator(page)} />
                    <input type="hidden" name="pageNumber" value={page} />
                    <input type="hidden" name="kind" value="NOTE" />
                    <input type="hidden" name="quote" value={commentDraft.quote} />
                    <input type="hidden" name="annotationStyle" value="COMMENT" />
                    <input type="hidden" name="color" value={markColor} />
                    <input type="hidden" name="rects" value={JSON.stringify(commentDraft.rects)} />
                    <div>
                      <strong>{commentDraft.title}</strong>
                      <button type="button" onClick={() => setCommentDraft(null)} aria-label="关闭评论框">
                        ×
                      </button>
                    </div>
                    {activeAnnotationComments.length > 0 ? (
                      <ul>
                        {activeAnnotationComments.map((comment) => (
                          <li key={comment.id}>
                            <span>{comment.user.displayName}</span>
                            {comment.body}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {commentDraft.quote ? <blockquote>{commentDraft.quote}</blockquote> : null}
                    <textarea name="body" rows={3} required placeholder="写下这条标注的评论" />
                    <button className="button small" type="submit">
                      保存评论
                    </button>
                  </form>
                ) : null}
              </div>
              <div
                ref={textLayerRef}
                className="pdf-text-layer"
                style={pageSize.width ? { width: pageSize.width, height: pageSize.height } : undefined}
                onPointerDown={beginTextSelection}
                onPointerMove={updateTextSelection}
                onPointerUp={finishTextSelection}
              >
                {textItems.map((item, index) => (
                  <span
                    key={item.id}
                    data-text-index={index}
                    style={{
                      left: item.left,
                      top: item.top,
                      width: item.width,
                      height: item.height,
                      fontSize: item.fontSize,
                    }}
                  >
                    {item.str}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </main>

        <aside className="reader-note-dock zotero-record-sidebar">
          <div className="zotero-record-head">
            <h2>记录</h2>
            <span>{pageLocator(page)}</span>
          </div>
          <div className="zotero-record-list">
            {currentTopLevelRecords.length === 0 ? <p className="muted">这页还没有记录。</p> : null}
            {currentTopLevelRecords.map((record) => {
              const comments = commentsByParent.get(record.id) ?? [];
              const isAnnotation =
                record.kind === "HIGHLIGHT" &&
                (record.annotationStyle === "HIGHLIGHT" || record.annotationStyle === "UNDERLINE");
              const bodyText = isAnnotation && record.body === record.quote ? "" : recordBodyText(record);

              return (
                <article key={record.id} className="zotero-record-card">
                  <div className="zotero-record-card-head">
                    <span className={`record-type-dot type-${record.kind.toLowerCase()}`}>{recordIcon(record)}</span>
                    <strong>{record.locator || "整本书"}</strong>
                    <small>{record.user.displayName}</small>
                    <DeleteRecordButton recordId={record.id} />
                  </div>
                  {record.quote ? <blockquote>{record.quote}</blockquote> : null}
                  {bodyText ? <p>{bodyText}</p> : null}
                  {comments.length > 0 ? (
                    <div className="zotero-record-comments">
                      {comments.map((comment) => (
                        <div key={comment.id} className="zotero-record-comment">
                          <div>
                            <span>{comment.user.displayName}</span>
                            <DeleteRecordButton recordId={comment.id} />
                          </div>
                          <p>{comment.body}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </aside>
      </div>

      <form ref={highlightFormRef} action={createReadingRecordAction} className="hidden-reader-form">
        <input type="hidden" name="bookId" value={bookId} />
        <input type="hidden" name="returnTo" value={currentReturnTo} />
        <input type="hidden" name="chapterId" value={currentStoredChapter?.id || ""} />
        <input type="hidden" name="locator" value={pageLocator(page)} />
        <input type="hidden" name="pageNumber" value={page} />
        <input type="hidden" name="kind" value="HIGHLIGHT" />
        <input type="hidden" name="quote" value={selected?.text || ""} />
        <input type="hidden" name="body" value={selected?.text || pageLocator(page)} />
        <input type="hidden" name="annotationStyle" value="HIGHLIGHT" />
        <input type="hidden" name="color" value={markColor} />
        <input type="hidden" name="rects" value={JSON.stringify(selected?.rects || [])} />
      </form>

      <form ref={underlineFormRef} action={createReadingRecordAction} className="hidden-reader-form">
        <input type="hidden" name="bookId" value={bookId} />
        <input type="hidden" name="returnTo" value={currentReturnTo} />
        <input type="hidden" name="chapterId" value={currentStoredChapter?.id || ""} />
        <input type="hidden" name="locator" value={pageLocator(page)} />
        <input type="hidden" name="pageNumber" value={page} />
        <input type="hidden" name="kind" value="HIGHLIGHT" />
        <input type="hidden" name="quote" value={selected?.text || ""} />
        <input type="hidden" name="body" value={selected?.text || pageLocator(page)} />
        <input type="hidden" name="annotationStyle" value="UNDERLINE" />
        <input type="hidden" name="color" value={markColor} />
        <input type="hidden" name="rects" value={JSON.stringify(selected?.rects || [])} />
      </form>
    </div>
  );
}
