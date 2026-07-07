import Link from "next/link";
import { PostSection } from "@prisma/client";
import { canAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ChenyanPage() {
  const user = await requireUser();

  if (!canAdmin(user.role)) {
    return (
      <div className="stack">
        <section className="page-header">
          <div>
            <p className="pill">陈言普语</p>
            <h1 className="page-title">该板块暂无内容</h1>
          </div>
        </section>
        <article className="content-card empty-state">
          <h2>该板块暂无内容</h2>
          <p className="muted">这里暂时没有可以浏览的内容。</p>
        </article>
      </div>
    );
  }

  const [posts, recordings] = await Promise.all([
    prisma.post.findMany({
      where: { section: PostSection.CHENYAN },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { displayName: true } } },
    }),
    prisma.callRecording.findMany({
      orderBy: { createdAt: "desc" },
      include: { uploader: { select: { displayName: true } } },
    }),
  ]);

  return (
    <div className="stack">
      <section className="page-header">
        <div>
          <p className="pill">管理员专属</p>
          <h1 className="page-title">陈言普语</h1>
        </div>
        <div className="article-actions">
          <Link className="button secondary" href="/chenyan/recordings/new">
            上传通话录音
          </Link>
          <Link className="button" href="/chenyan/new">
            写新文章
          </Link>
        </div>
      </section>

      <section className="post-list">
        {posts.length === 0 ? (
          <article className="content-card empty-state">
            <h2>还没有文章</h2>
            <p className="muted">陈言普语的文章会出现在这里。</p>
          </article>
        ) : null}

        {posts.map((post) => (
          <Link className="content-card post-card" href={`/chenyan/${post.id}`} key={post.id}>
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

      <section className="stack">
        <div className="section-heading">
          <p className="pill">通话录音</p>
          <h2>录音存档</h2>
        </div>
        {recordings.length === 0 ? (
          <article className="content-card empty-state">
            <h2>还没有录音</h2>
            <p className="muted">上传后的通话录音会出现在这里。</p>
          </article>
        ) : null}
        {recordings.map((recording) => (
          <article className="content-card post-card" key={recording.id}>
            <div className="post-card-head">
              <span className="pill">{recording.uploader.displayName}</span>
              <span className="muted">{recording.createdAt.toLocaleString("zh-CN")}</span>
            </div>
            <h2>{recording.title}</h2>
            {recording.description ? <p className="muted">{recording.description}</p> : null}
            <audio controls preload="metadata" src={recording.audioUrl} />
          </article>
        ))}
      </section>
    </div>
  );
}
