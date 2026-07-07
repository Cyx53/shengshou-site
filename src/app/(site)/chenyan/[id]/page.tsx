import Link from "next/link";
import { notFound } from "next/navigation";
import { PostSection } from "@prisma/client";
import { ArticleBody } from "@/components/ArticleBody";
import { CommentSection } from "@/components/CommentSection";
import { canAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ChenyanPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canAdmin(user.role)) notFound();

  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: { author: { select: { displayName: true } } },
  });

  if (!post || post.section !== PostSection.CHENYAN) notFound();

  const comments = await prisma.comment.findMany({
    where: { targetType: "POST", targetId: post.id, status: "PUBLISHED" },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { displayName: true } } },
  });

  return (
    <article className="stack flower-article-shell">
      <section className="flower-article article-card">
        <div className="article-actions">
          <Link className="button secondary" href="/chenyan">
            返回列表
          </Link>
          <Link className="button" href={`/chenyan/${post.id}/edit`}>
            编辑文章
          </Link>
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
        returnTo={`/chenyan/${post.id}`}
      />
    </article>
  );
}
