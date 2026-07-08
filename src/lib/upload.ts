import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
  "audio/x-m4a",
]);
const BOOK_TYPES = new Map([
  ["application/pdf", "PDF"],
  ["application/epub+zip", "EPUB"],
  ["text/plain", "TXT"],
]);

export function detectMediaKind(type: string) {
  if (IMAGE_TYPES.has(type)) return "PHOTO" as const;
  if (VIDEO_TYPES.has(type)) return "VIDEO" as const;
  return null;
}

export async function saveUpload(file: File) {
  const kind = detectMediaKind(file.type);
  if (!kind) {
    throw new Error("仅支持 JPG、PNG、WebP、GIF、MP4、WebM 和 MOV 文件。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name).toLowerCase() || (kind === "PHOTO" ? ".jpg" : ".mp4");
  const filename = `${randomUUID()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), bytes);

  return {
    kind,
    url: `/uploads/${filename}`,
  };
}

export async function saveImageUpload(file: File) {
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error("封面仅支持 JPG、PNG、WebP 和 GIF 文件。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name).toLowerCase() || ".jpg";
  const filename = `${randomUUID()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), bytes);

  return `/uploads/${filename}`;
}

export async function saveBookUpload(file: File) {
  const ext = path.extname(file.name).toLowerCase();
  const format =
    BOOK_TYPES.get(file.type) ??
    (ext === ".pdf" ? "PDF" : ext === ".epub" ? "EPUB" : ext === ".txt" ? "TXT" : null);

  if (!format) {
    throw new Error("电子书仅支持 PDF、EPUB 和 TXT 文件。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}${ext || ".book"}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "books");

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), bytes);

  return {
    format: format as "PDF" | "EPUB" | "TXT",
    url: `/uploads/books/${filename}`,
    path: path.join(uploadDir, filename),
  };
}

export async function saveAudioUpload(file: File) {
  const ext = path.extname(file.name).toLowerCase();
  const allowedExts = new Set([".mp3", ".m4a", ".wav", ".aac", ".ogg", ".webm", ".flac"]);
  if (!AUDIO_TYPES.has(file.type) && !allowedExts.has(ext)) {
    throw new Error("通话录音仅支持 MP3、M4A、WAV、AAC、OGG、WebM 和 FLAC 文件。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}${ext || ".audio"}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "recordings");

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), bytes);

  return `/uploads/recordings/${filename}`;
}

export async function deleteUploadByUrl(url: string | null | undefined) {
  if (!url?.startsWith("/uploads/")) return;

  const publicDir = path.join(process.cwd(), "public");
  const targetPath = path.normalize(path.join(publicDir, url));
  const uploadsDir = path.normalize(path.join(publicDir, "uploads"));

  if (!targetPath.startsWith(uploadsDir)) return;
  await unlink(targetPath).catch(() => undefined);
}
