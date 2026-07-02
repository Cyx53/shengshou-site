import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentSection } from "@/components/CommentSection";
import { canPublish, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const user = await requireUser();
  const { albumId } = await params;
  const album = await prisma.memoryAlbum.findUnique({
    where: { id: albumId },
    include: { items: { orderBy: { createdAt: "desc" } } },
  });

  if (!album) notFound();

  const comments = await prisma.comment.findMany({
    where: { targetType: "MEMORY_ALBUM", targetId: album.id, status: "PUBLISHED" },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { displayName: true } } },
  });

  return (
    <div className="stack">
      <section className="page-header">
        <div>
          <p className="pill">心路相册</p>
          <h1 className="page-title">{album.title}</h1>
          <p className="muted">{album.description || "照片和视频会在这里慢慢长出来。"}</p>
        </div>
        <div className="actions-row">
          <Link className="button secondary" href="/memories">
            返回列表
          </Link>
          {canPublish(user.role) ? (
            <>
              <Link className="button" href={`/memories/${album.id}/upload`}>
                上传照片/视频
              </Link>
              <Link className="button secondary" href={`/memories/${album.id}/edit`}>
                编辑相册
              </Link>
            </>
          ) : null}
        </div>
      </section>

      <section className="media-grid">
        {album.items.length === 0 ? (
          <article className="content-card empty-state">
            <h2>还没有照片或视频</h2>
            <p className="muted">上传后的内容会出现在这里。</p>
          </article>
        ) : null}

        {album.items.map((item) => (
          <Link className="media-card" href={`/memories/${album.id}/${item.id}`} key={item.id}>
            {item.kind === "PHOTO" ? (
              <img src={item.mediaUrl} alt={item.title} />
            ) : (
              <video src={item.mediaUrl} muted />
            )}
            <div className="body">
              <strong>{item.title}</strong>
              <p className="muted">{item.description || "暂无描述"}</p>
            </div>
          </Link>
        ))}
      </section>

      <CommentSection
        title="相册评论"
        comments={comments}
        currentUser={user}
        targetType="MEMORY_ALBUM"
        targetId={album.id}
        returnTo={`/memories/${album.id}`}
      />
    </div>
  );
}
