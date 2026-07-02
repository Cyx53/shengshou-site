import Link from "next/link";
import { notFound } from "next/navigation";
import { PdfPageReader } from "@/components/PdfPageReader";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const recordNames = {
  NOTE: "笔记",
  HIGHLIGHT: "勾画",
  BOOKMARK: "书签",
  REFLECTION: "心得",
} as const;

export default async function BookReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      uploader: { select: { displayName: true } },
      chapters: { orderBy: { position: "asc" } },
      records: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { displayName: true } },
          chapter: { select: { title: true } },
        },
      },
    },
  });

  if (!book) notFound();

  if (book.format === "PDF") {
    return (
      <PdfPageReader
        bookId={book.id}
        title={book.title}
        author={book.author}
        coverUrl={book.coverUrl}
        uploaderName={book.uploader.displayName}
        fileUrl={book.fileUrl}
        returnTo={`/guandaoguan/books/${book.id}`}
        chapters={book.chapters}
        records={book.records}
      />
    );
  }

  return (
    <div className="reader-page">
      <section className="reader-head">
        <Link className="button secondary small" href="/guandaoguan">
          返回观道观
        </Link>
        <div className="reader-book-meta">
          <div className="reader-cover">
            {book.coverUrl ? <img src={book.coverUrl} alt="" /> : <span>{book.title.slice(0, 2)}</span>}
          </div>
          <div>
            <p className="pill">{book.format}</p>
            <h1>{book.title}</h1>
            <p className="muted">
              {book.author || "佚名"} · 上传者 {book.uploader.displayName}
            </p>
            {book.description ? <p>{book.description}</p> : null}
          </div>
        </div>
      </section>

      <section className="reader-frame-wrap">
        {book.format === "TXT" ? (
          <iframe className="reader-frame" src={book.fileUrl} title={book.title} />
        ) : (
          <div className="epub-placeholder">
            <h2>EPUB 文件已入库</h2>
            <p>
              当前一期先保存文件、目录和协作记录。EPUB 的分页渲染与自动目录解析会在下一步接入阅读引擎。
            </p>
            <a className="button" href={book.fileUrl} download>
              下载/打开 EPUB
            </a>
          </div>
        )}
      </section>

      <section className="reading-records">
        <div className="section-line-head">
          <h2>共同阅读记录</h2>
          <span>{book.records.length} 条</span>
        </div>
        {book.records.length === 0 ? <p className="muted">还没有人留下记录。</p> : null}
        <div className="record-list">
          {book.records.map((record) => (
            <article className="record-card" key={record.id}>
              <div>
                <span className="book-format">{recordNames[record.kind]}</span>
                <strong>{record.user.displayName}</strong>
                <small>
                  {record.chapter?.title || "整本书"} {record.locator ? `· ${record.locator}` : ""}
                </small>
              </div>
              {record.quote ? <blockquote>{record.quote}</blockquote> : null}
              <p>{record.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
