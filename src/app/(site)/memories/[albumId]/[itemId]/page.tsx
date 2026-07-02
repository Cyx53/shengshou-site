import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentSection } from "@/components/CommentSection";
import { canPublish, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function MemoryItemPage({
  params,
}: {
  params: Promise<{ albumId: string; itemId: string }>;
}) {
  const user = await requireUser();
  const { albumId, itemId } = await params;
  const item = await prisma.memoryItem.findUnique({
    where: { id: itemId },
    include: { album: true },
  });

  if (!item || item.albumId !== albumId) notFound();

  const comments = await prisma.comment.findMany({
    where: { targetType: "MEMORY_ITEM", targetId: item.id, status: "PUBLISHED" },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { displayName: true } } },
  });

  return (
    <div className="stack">
      <section className="content-card media-detail">
        <div className="article-actions">
          <Link className="button secondary" href={`/memories/${item.albumId}`}>
            返回相册
          </Link>
          {canPublish(user.role) ? (
            <Link className="button" href={`/memories/${item.albumId}/${item.id}/edit`}>
              编辑照片/视频
            </Link>
          ) : null}
        </div>
        <span className="pill">{item.kind === "PHOTO" ? "照片" : "视频"}</span>
        <h1 className="page-title">{item.title}</h1>
        <p className="muted">{item.description || item.album.title}</p>
        {item.kind === "PHOTO" ? (
          <img src={item.mediaUrl} alt={item.title} />
        ) : (
          <video src={item.mediaUrl} controls />
        )}
      </section>

      <CommentSection
        title="照片/视频评论"
        comments={comments}
        currentUser={user}
        targetType="MEMORY_ITEM"
        targetId={item.id}
        returnTo={`/memories/${item.albumId}/${item.id}`}
      />
    </div>
  );
}
