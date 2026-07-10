import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".mp4", "video/mp4"],
  [".mov", "video/quicktime"],
  [".webm", "video/webm"],
  [".mp3", "audio/mpeg"],
  [".m4a", "audio/mp4"],
  [".wav", "audio/wav"],
  [".aac", "audio/aac"],
  [".ogg", "audio/ogg"],
  [".flac", "audio/flac"],
  [".pdf", "application/pdf"],
  [".epub", "application/epub+zip"],
  [".txt", "text/plain; charset=utf-8"],
]);

function uploadPath(segments: string[]) {
  if (segments.some((segment) => segment === ".." || segment.includes("\\") || segment.includes("/"))) {
    return null;
  }

  const uploadRoot = path.resolve(
    path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads"),
  );
  const targetPath = path.resolve(uploadRoot, ...segments);
  if (targetPath !== uploadRoot && !targetPath.startsWith(`${uploadRoot}${path.sep}`)) return null;
  return targetPath;
}

function streamResponse(filePath: string, size: number, request: Request) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES.get(ext) ?? "application/octet-stream";
  const range = request.headers.get("range");

  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : size - 1;
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < size) {
        const finalEnd = Math.min(end, size - 1);
        const stream = createReadStream(filePath, { start, end: finalEnd });
        return new Response(Readable.toWeb(stream) as ReadableStream, {
          status: 206,
          headers: {
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Length": String(finalEnd - start + 1),
            "Content-Range": `bytes ${start}-${finalEnd}/${size}`,
            "Content-Type": contentType,
          },
        });
      }
    }
  }

  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(size),
      "Content-Type": contentType,
    },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const filePath = uploadPath(segments);
  if (!filePath) return new Response("Not found", { status: 404 });

  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) return new Response("Not found", { status: 404 });

  return streamResponse(filePath, fileStat.size, request);
}
