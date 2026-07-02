import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canPublish, requireUser } from "@/lib/auth";

export default async function GuanDaoGuanPage() {
  const user = await requireUser();
  const [books, works] = await Promise.all([
    prisma.book.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        uploader: { select: { displayName: true } },
        _count: { select: { records: true, chapters: true } },
      },
    }),
    prisma.creativeWork.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        author: { select: { displayName: true } },
        _count: { select: { chapters: true } },
      },
      take: 4,
    }),
  ]);

  return (
    <div className="library-page">
      <section className="library-hero">
        <div>
          <p className="pill">书库与创作空间</p>
          <h1>观道观</h1>
          <p>
            收纳电子书、共同阅读、留下笔记与心得；也在这里开辟自己的长篇创作。
          </p>
        </div>
        <div className="library-actions">
          {canPublish(user.role) ? (
            <Link className="button" href="/guandaoguan/books/new">
              上传电子书
            </Link>
          ) : null}
          <Link className="button secondary" href="/guandaoguan/studio">
            进入创作空间
          </Link>
        </div>
      </section>

      <section className="library-grid">
        <div>
          <div className="section-line-head">
            <h2>书库</h2>
            <span>{books.length} 本</span>
          </div>
          <div className="book-grid">
            {books.length === 0 ? (
              <article className="content-card empty-state">
                <h2>还没有书</h2>
                <p className="muted">上传 PDF、EPUB 或 TXT 后会出现在这里。</p>
              </article>
            ) : null}
            {books.map((book) => (
              <Link className="book-card" href={`/guandaoguan/books/${book.id}`} key={book.id}>
                <div className="book-cover">
                  {book.coverUrl ? <img src={book.coverUrl} alt="" /> : <span>{book.title.slice(0, 2)}</span>}
                </div>
                <div>
                  <span className="book-format">{book.format}</span>
                  <h3>{book.title}</h3>
                  <p>{book.author || "佚名"} · {book._count.chapters} 章 · {book._count.records} 条记录</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <aside className="studio-preview">
          <div className="section-line-head">
            <h2>创作空间</h2>
            <Link href="/guandaoguan/studio">全部</Link>
          </div>
          <div className="studio-list">
            {works.length === 0 ? <p className="muted">还没有作品。</p> : null}
            {works.map((work) => (
              <Link href={`/guandaoguan/studio/${work.id}`} key={work.id}>
                <strong>{work.title}</strong>
                <span>{work.author.displayName} · {work._count.chapters} 章</span>
              </Link>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
