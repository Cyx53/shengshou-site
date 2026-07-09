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

      <section className="two-col">
        <div className="form-panel">
          <h2>单条上传</h2>
          <form
            action="/api/chenyan/recordings"
            method="post"
            encType="multipart/form-data"
            className="form-grid"
          >
            <label>
              本次通话标题
              <input name="title" placeholder="可留空，默认使用录音文件名" />
            </label>
            <label>
              通话说明
              <textarea name="description" placeholder="记录通话对象、时间或要点" />
            </label>
            <label>
              通话笔记
              <textarea name="notes" placeholder="可以稍后在通话详情中继续整理" />
            </label>
            <label>
              录音文件
              <input
                name="files"
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.webm,.flac"
                required
              />
            </label>
            <button className="button" type="submit">
              保存录音
            </button>
          </form>
        </div>

        <div className="form-panel">
          <h2>文件夹批量上传</h2>
          <form
            action="/api/chenyan/recordings"
            method="post"
            encType="multipart/form-data"
            className="form-grid"
          >
            <label>
              本次通话标题
              <input name="title" required placeholder="例如：2026 年 7 月 9 日晚间通话" />
            </label>
            <label>
              通话说明
              <textarea name="description" placeholder="记录通话对象、时间或主题" />
            </label>
            <label>
              通话笔记
              <textarea name="notes" placeholder="本次通话的整体笔记，可稍后继续整理" />
            </label>
            <label>
              录音文件夹
              <input
                name="files"
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.webm,.flac"
                multiple
                required
                {...{ webkitdirectory: "", directory: "" }}
              />
            </label>
            <p className="muted">
              文件夹代表一次通话，文件夹内的每个音频会成为这次通话中的一条录音。
            </p>
            <button className="button" type="submit">
              保存整个文件夹
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
