import Link from "next/link";
import { notFound } from "next/navigation";
import { uploadMemoryItemAction } from "@/app/actions";
import { MemoryItemForm } from "@/components/MemoryItemForm";
import { canPublish, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function UploadMemoryItemPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const user = await requireUser();
  if (!canPublish(user.role)) notFound();

  const { albumId } = await params;
  const album = await prisma.memoryAlbum.findUnique({ where: { id: albumId } });
  if (!album) notFound();

  return (
    <div className="stack">
      <section className="page-header">
        <div>
          <p className="pill">{album.title}</p>
          <h1 className="page-title">上传照片/视频</h1>
        </div>
        <Link className="button secondary" href={`/memories/${album.id}`}>
          返回相册
        </Link>
      </section>

      <section className="form-panel full-editor-panel">
        <MemoryItemForm
          action={uploadMemoryItemAction}
          albumId={album.id}
          includeFile
          submitLabel="上传"
        />
      </section>
    </div>
  );
}
