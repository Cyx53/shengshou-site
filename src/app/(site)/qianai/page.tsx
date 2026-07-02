import Link from "next/link";
import { PostSection } from "@prisma/client";
import { canPublish, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function QianaiPage() {
  const user = await requireUser();
  const posts = await prisma.post.findMany({
    where:
      user.role === "ADMIN"
        ? { section: PostSection.QIANAI }
        : user.role === "PUBLISHER"
          ? {
              section: PostSection.QIANAI,
              OR: [{ status: "PUBLISHED" }, { authorId: user.id }],
            }
          : { section: PostSection.QIANAI, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { displayName: true } } },
  });

  return (
    <div className="stack">
      <section className="page-header">
        <div>
          <p className="pill">文章列表</p>
          <h1 className="page-title">谦爱集</h1>
        </div>
        {canPublish(user.role) ? (
          <Link className="button" href="/qianai/new">
            写新文章
          </Link>
        ) : null}
      </section>

      <section className="post-list">
        {posts.length === 0 ? (
          <article className="content-card empty-state">
            <h2>还没有文章</h2>
            <p className="muted">谦爱集的文章会出现在这里。</p>
          </article>
        ) : null}

        {posts.map((post) => (
          <Link className="content-card post-card" href={`/qianai/${post.id}`} key={post.id}>
            <div className="post-card-head">
              <span className="pill">{post.status === "PUBLISHED" ? "已发布" : "草稿"}</span>
              <span className="muted">{post.createdAt.toLocaleDateString("zh-CN")}</span>
            </div>
            <h2>{post.title}</h2>
            <p className="muted">{post.excerpt || "暂无摘要"}</p>
            <p className="muted">作者：{post.author.displayName}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
