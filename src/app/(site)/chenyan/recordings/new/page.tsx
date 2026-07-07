import Link from "next/link";
import { notFound } from "next/navigation";
import { canAdmin, requireUser } from "@/lib/auth";

export default async function NewCallRecordingPage() {
  const user = await requireUser();
  if (!canAdmin(user.role)) notFound();

  return (
    <div className="stack">
      <section className="page-header">
        <div>
          <p className="pill">陈言普语</p>
          <h1 className="page-title">上传通话录音</h1>
        </div>
        <Link className="button secondary" href="/chenyan">
          返回列表
        </Link>
      </section>

      <section className="form-panel">
        <form
          action="/api/chenyan/recordings"
          method="post"
          encType="multipart/form-data"
          className="form-grid"
        >
          <label>
            标题
            <input name="title" placeholder="可留空，默认使用文件名" />
          </label>
          <label>
            说明
            <textarea name="description" placeholder="记录通话对象、时间或要点" />
          </label>
          <label>
            录音文件
            <input
              name="file"
              type="file"
              accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.webm,.flac"
              required
            />
          </label>
          <button className="button" type="submit">
            保存录音
          </button>
        </form>
      </section>
    </div>
  );
}
