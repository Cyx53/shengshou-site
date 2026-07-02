import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createCreativeChapterAction,
  deleteCreativeChapterAction,
  deleteCreativeWorkAction,
  updateCreativeChapterAction,
} from "@/app/actions";
import { ArticleBody } from "@/components/ArticleBody";
import { RichTextEditor } from "@/components/RichTextEditor";
import { canAdmin, canPublish, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function plainLength(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, "").length;
}

export default async function CreativeWorkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ chapter?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const work = await prisma.creativeWork.findUnique({
    where: { id },
    include: {
      author: { select: { displayName: true } },
      chapters: { orderBy: { position: "asc" } },
    },
  });

  if (!work) notFound();
  const canWrite = canAdmin(user.role) || (canPublish(user.role) && work.authorId === user.id);
  const totalWords = work.chapters.reduce((sum, chapter) => sum + plainLength(chapter.content), 0);
  const selectedChapter = work.chapters.find((chapter) => chapter.id === query.chapter) ?? null;

  return (
    <div className="studio-writer">
      <header className="studio-writer-top">
        <div className="writer-crumb">
          <Link href="/guandaoguan/studio">创作空间</Link>
          <span>/</span>
          <strong>{work.title}</strong>
        </div>
        <div className="writer-top-actions">
          <Link className="button secondary small" href="/guandaoguan/studio">
            返回作品列表
          </Link>
          {canWrite ? (
            <form action={deleteCreativeWorkAction}>
              <input type="hidden" name="workId" value={work.id} />
              <button className="button secondary small danger-lite" type="submit">
                删除作品
              </button>
            </form>
          ) : null}
        </div>
      </header>

      <section className="studio-writer-layout">
        <aside className="writer-sidebar">
          <div className="writer-search">
            <input placeholder="搜索章节" />
          </div>
          {canWrite ? (
            <Link className="writer-new-chapter" href={`/guandaoguan/studio/${work.id}#editor`}>
              + 新建章节
            </Link>
          ) : null}
          <div className="writer-chapter-group">
            <h2>章节列表 <span>{work.chapters.length}章</span></h2>
            {work.chapters.length === 0 ? <p className="muted">暂无章节。</p> : null}
            {work.chapters.map((chapter) => (
              <article className={`writer-chapter-item ${selectedChapter?.id === chapter.id ? "is-active" : ""}`} key={chapter.id}>
                <Link href={`/guandaoguan/studio/${work.id}?chapter=${chapter.id}#editor`}>
                  <strong>{chapter.title}</strong>
                  <span>{plainLength(chapter.content)} 字 · 第 {chapter.position} 章</span>
                </Link>
                {canWrite ? (
                  <form action={deleteCreativeChapterAction}>
                    <input type="hidden" name="chapterId" value={chapter.id} />
                    <button type="submit">删除</button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </aside>

        <main className="writer-main">
          {canWrite ? (
            <section id="editor" className="writer-editor-card">
              <form
                action={selectedChapter ? updateCreativeChapterAction : createCreativeChapterAction}
                className="writer-editor-form"
              >
                {selectedChapter ? (
                  <input type="hidden" name="chapterId" value={selectedChapter.id} />
                ) : (
                  <input type="hidden" name="workId" value={work.id} />
                )}
                <div className="writer-editor-head">
                  <div>
                    <span>{selectedChapter ? `第 ${selectedChapter.position} 章 · 编辑中` : `第 ${work.chapters.length + 1} 章 · 新建`}</span>
                    <input
                      name="title"
                      required
                      defaultValue={selectedChapter?.title}
                      placeholder="请输入章节名，例如：第一章 风起"
                    />
                  </div>
                  <button className="button" type="submit">
                    {selectedChapter ? "保存修改" : "保存章节"}
                  </button>
                </div>
                <RichTextEditor
                  key={selectedChapter?.id ?? "new-chapter"}
                  name="content"
                  initialValue={selectedChapter?.content ?? ""}
                  label="正文"
                />
              </form>
            </section>
          ) : null}

          <section className="writer-preview-stack">
            {work.chapters.length === 0 ? (
              <article className="writer-empty-manuscript">
                <h2>还没有章节</h2>
                <p>从第一章开始，写下一段能让你自己也愿意继续读的开头。</p>
              </article>
            ) : null}
            {work.chapters.map((chapter) => (
              <article id={`chapter-${chapter.id}`} className="writer-chapter-preview" key={chapter.id}>
                <p className="pill">第 {chapter.position} 章</p>
                <h2>{chapter.title}</h2>
                <ArticleBody content={chapter.content} />
              </article>
            ))}
          </section>
        </main>

        <aside className="writer-inspector">
          <div className="creative-cover large">
            {work.coverUrl ? <img src={work.coverUrl} alt="" /> : <span>{work.title.slice(0, 2)}</span>}
          </div>
          <h1>{work.title}</h1>
          <p>{work.author.displayName}</p>
          {work.synopsis ? <p className="writer-synopsis">{work.synopsis}</p> : null}
          <dl className="writer-stats">
            <div>
              <dt>章节</dt>
              <dd>{work.chapters.length}</dd>
            </div>
            <div>
              <dt>字数</dt>
              <dd>{totalWords}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </div>
  );
}
