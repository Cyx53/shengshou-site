import Link from "next/link";
import { deleteCreativeWorkAction } from "@/app/actions";
import { canAdmin, canPublish, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function StudioPage() {
  const user = await requireUser();
  const works = await prisma.creativeWork.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      author: { select: { displayName: true } },
      _count: { select: { chapters: true } },
    },
  });

  return (
    <div className="studio-console">
      <header className="studio-console-top">
        <div>
          <p className="pill">观道观</p>
          <h1>创作空间</h1>
          <p>像网文后台一样管理作品、章节和文稿导入，作品列表只围绕内容、作者和章节展开。</p>
        </div>
        <div className="actions-row">
          <Link className="button secondary" href="/guandaoguan">
            返回书库
          </Link>
          {canPublish(user.role) ? (
            <Link className="button" href="/guandaoguan/studio/new">
              新建作品
            </Link>
          ) : null}
        </div>
      </header>

      <section className="creative-grid studio-shelf">
        {works.length === 0 ? (
          <article className="content-card empty-state">
            <h2>还没有作品</h2>
            <p className="muted">先创建一部作品，然后进入写作台新增章节。</p>
          </article>
        ) : null}
        {works.map((work) => {
          const canManage = canAdmin(user.role) || (canPublish(user.role) && work.authorId === user.id);

          return (
            <article className="creative-card studio-work-card" key={work.id}>
              <Link href={`/guandaoguan/studio/${work.id}`}>
                <div className="creative-cover">
                  {work.coverUrl ? <img src={work.coverUrl} alt="" /> : <span>{work.title.slice(0, 2)}</span>}
                </div>
                <div>
                  <span className="book-format">作品</span>
                  <h2>{work.title}</h2>
                  <p>{work.author.displayName} · {work._count.chapters} 章</p>
                  {work.synopsis ? <p>{work.synopsis}</p> : null}
                  {canManage ? <small>我的写作台</small> : null}
                </div>
              </Link>
              {canManage ? (
                <form action={deleteCreativeWorkAction} className="studio-delete-form">
                  <input type="hidden" name="workId" value={work.id} />
                  <button type="submit">删除作品</button>
                </form>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
