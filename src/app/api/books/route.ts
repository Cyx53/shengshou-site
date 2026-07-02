import { BookFormat } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { canPublish, getCurrentUser } from "@/lib/auth";
import { extractPdfToc } from "@/lib/pdf-toc";
import { prisma } from "@/lib/prisma";
import { saveBookUpload, saveImageUpload } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PDF_TOC_AUTO_EXTRACT_LIMIT = 80 * 1024 * 1024;

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function tocLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      title: line.replace(/^\d+[\.、\s-]*/, ""),
      position: index + 1,
      locator: `${index + 1}`,
    }));
}

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return redirectTo(request, "/login");
  if (!canPublish(user.role)) return redirectTo(request, "/guandaoguan");

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return redirectTo(request, "/guandaoguan/books/new");
  }

  const upload = await saveBookUpload(file);
  const coverFile = formData.get("coverFile");
  const coverUrl =
    coverFile instanceof File && coverFile.size > 0
      ? await saveImageUpload(coverFile)
      : stringValue(formData, "coverUrl") || null;

  const manualChapters = tocLines(stringValue(formData, "toc"));
  const detectedChapters =
    upload.format === "PDF" && file.size <= PDF_TOC_AUTO_EXTRACT_LIMIT
      ? await extractPdfToc(upload.path).catch(() => [])
      : [];
  const chapters = detectedChapters.length > 0 ? detectedChapters : manualChapters;

  const book = await prisma.book.create({
    data: {
      title: stringValue(formData, "title") || file.name.replace(/\.[^.]+$/, ""),
      author: stringValue(formData, "author") || null,
      description: stringValue(formData, "description") || null,
      coverUrl,
      fileUrl: upload.url,
      format: upload.format as BookFormat,
      sourceUrl: null,
      uploaderId: user.id,
      chapters: chapters.length ? { create: chapters } : undefined,
    },
  });

  revalidatePath("/guandaoguan");
  return redirectTo(request, `/guandaoguan/books/${book.id}`);
}
