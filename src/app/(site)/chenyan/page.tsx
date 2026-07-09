import Link from "next/link";
import { PostSection } from "@prisma/client";
import { deleteCallSessionAction } from "@/app/actions";
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

  const [posts, sessions] = await Promise.all([
    prisma.post.findMany({
      where: { section: PostSection.CHENYAN },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { displayName: true } } },
    }),
    prisma.callSession.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        uploader: { select: { displayName: true } },
        _count: { select: { recordings: true } },
      },
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
            新建通话
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
          <p className="pill">通话档案</p>
          <h2>一次通话，一张卡片</h2>
        </div>
        {sessions.length === 0 ? (
          <article className="content-card empty-state">
            <h2>还没有通话</h2>
            <p className="muted">上传一条录音或一个录音文件夹，建立第一份通话档案。</p>
          </article>
        ) : null}
        <div className="call-session-grid">
          {sessions.map((session) => (
            <article className="content-card call-session-card" key={session.id}>
              <Link href={`/chenyan/calls/${session.id}`} className="call-session-link">
                <div className="post-card-head">
                  <span className="pill">{session._count.recordings} 条录音</span>
                  <span className="muted">{session.createdAt.toLocaleString("zh-CN")}</span>
                </div>
                <h2>{session.title}</h2>
                <p className="muted">{session.description || "暂无通话说明"}</p>
                <p className="muted">整理人：{session.uploader.displayName}</p>
              </Link>
              <form action={deleteCallSessionAction}>
                <input type="hidden" name="sessionId" value={session.id} />
                <button className="text-danger" type="submit">
                  删除本次通话
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
