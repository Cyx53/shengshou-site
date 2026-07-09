import Link from "next/link";
import { notFound } from "next/navigation";
import { ChenyanRecordingUploader } from "@/components/ChenyanRecordingUploader";
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
          <p className="muted">一次通话生成一张卡片，文件夹中的每条录音会逐条上传。</p>
        </div>
        <Link className="button secondary" href="/chenyan">
          返回列表
        </Link>
      </section>

      <section className="form-panel">
        <ChenyanRecordingUploader />
      </section>
    </div>
  );
}
