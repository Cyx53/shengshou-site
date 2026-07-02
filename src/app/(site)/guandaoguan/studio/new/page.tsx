import Link from "next/link";
import { notFound } from "next/navigation";
import { createCreativeWorkAction } from "@/app/actions";
import { canPublish, requireUser } from "@/lib/auth";

export default async function NewCreativeWorkPage() {
  const user = await requireUser();
  if (!canPublish(user.role)) notFound();

  return (
    <div className="studio-console">
      <header className="studio-console-top">
        <div>
          <p className="pill">创作空间</p>
          <h1>创建作品</h1>
          <p>先立一部作品档案，再进入写作台拆分章节、导入文稿、持续写下去。</p>
        </div>
        <Link className="button secondary" href="/guandaoguan/studio">
          返回创作空间
        </Link>
      </header>

      <section className="studio-create-panel">
        <form action={createCreativeWorkAction} className="studio-create-form">
          <label>
            作品名
            <input name="title" required placeholder="例如：风雨飘摇三百年" />
          </label>
          <label>
            作品简介
            <textarea name="synopsis" rows={6} placeholder="写给自己和读者看的故事方向。" />
          </label>
          <div className="studio-form-grid">
            <label>
              上传封面
              <input name="coverFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
            </label>
            <label>
              封面地址
              <input name="coverUrl" placeholder="有封面文件时可留空" />
            </label>
          </div>
          <button className="button" type="submit">
            创建并进入写作台
          </button>
        </form>
      </section>
    </div>
  );
}
