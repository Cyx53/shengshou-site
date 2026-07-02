import Link from "next/link";
import { notFound } from "next/navigation";
import { PostSection } from "@prisma/client";
import { ArticleBody } from "@/components/ArticleBody";
import { CommentSection } from "@/components/CommentSection";
import { prisma } from "@/lib/prisma";
import { canAdmin, canPublish, requireUser } from "@/lib/auth";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: { author: { select: { displayName: true } } },
  });

  if (
    !post ||
    post.section !== PostSection.BLOG ||
    (post.status !== "PUBLISHED" &&
      !canAdmin(user.role) &&
      !(canPublish(user.role) && post.authorId === user.id))
  ) {
    notFound();
  }
  const canManage = canPublish(user.role) && (canAdmin(user.role) || post.authorId === user.id);

  const comments = await prisma.comment.findMany({
    where: { targetType: "POST", targetId: post.id, status: "PUBLISHED" },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { displayName: true } } },
  });

  return (
    <article className="stack flower-article-shell">
      <section className="flower-article article-card">
        <div className="article-actions">
          <Link className="button secondary" href="/blog">
            返回列表
          </Link>
          {canManage ? (
            <Link className="button" href={`/blog/${post.id}/edit`}>
              编辑文章
            </Link>
          ) : null}
        </div>
        <span className="pill">{post.status === "PUBLISHED" ? "已发布" : "草稿"}</span>
        <h1 className="page-title">{post.title}</h1>
        <p className="muted">
          {post.author.displayName} · {post.createdAt.toLocaleString("zh-CN")}
        </p>
        {post.coverUrl ? <img src={post.coverUrl} alt="" /> : null}
        <ArticleBody content={post.content} />
      </section>
      <CommentSection
        comments={comments}
        currentUser={user}
        targetType="POST"
        targetId={post.id}
        returnTo={`/blog/${post.id}`}
      />
    </article>
  );
}
