import Link from "next/link";
import { notFound } from "next/navigation";
import { canPublish, requireUser } from "@/lib/auth";

export default async function NewBookPage() {
  const user = await requireUser();
  if (!canPublish(user.role)) notFound();

  return (
    <div>
      <section className="page-header">
        <div>
          <p className="pill">观道观</p>
          <h1 className="page-title">上传电子书</h1>
          <p className="muted">支持 PDF、EPUB、TXT。PDF 会在上传后自动识别目录，手动目录只作为补充兜底。</p>
        </div>
        <Link className="button secondary" href="/guandaoguan">
          返回书库
        </Link>
      </section>

      <section className="form-panel full-editor-panel">
        <form action="/api/books" method="post" encType="multipart/form-data" className="form-grid">
          <label>
            书名
            <input name="title" required />
          </label>
          <label>
            作者
            <input name="author" />
          </label>
          <label>
            简介
            <textarea name="description" />
          </label>
          <label>
            电子书文件
            <input name="file" type="file" accept=".pdf,.epub,.txt,application/pdf,application/epub+zip,text/plain" required />
          </label>
          <label>
            封面图片
            <input name="coverFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
          </label>
          <label>
            封面地址
            <input name="coverUrl" placeholder="有封面文件时可留空" />
          </label>
          <label>
            备用目录
            <textarea name="toc" placeholder={"自动识别失败时才会使用这里：\n序章\n第一章 风起\n第二章 入局"} />
          </label>
          <button className="button" type="submit">
            保存到书库
          </button>
        </form>
      </section>
    </div>
  );
}
