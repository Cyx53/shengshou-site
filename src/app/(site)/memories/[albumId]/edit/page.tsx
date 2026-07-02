import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAlbumAction, updateAlbumAction } from "@/app/actions";
import { AlbumForm } from "@/components/AlbumForm";
import { canPublish, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditAlbumPage({
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
          <p className="pill">相册设置</p>
          <h1 className="page-title">编辑相册</h1>
        </div>
        <Link className="button secondary" href={`/memories/${album.id}`}>
          返回相册
        </Link>
      </section>

      <section className="form-panel full-editor-panel">
        <AlbumForm action={updateAlbumAction} submitLabel="保存相册" album={album} />
        <form action={deleteAlbumAction} className="danger-zone">
          <input type="hidden" name="albumId" value={album.id} />
          <button className="button warn" type="submit">
            删除相册
          </button>
        </form>
      </section>
    </div>
  );
}
