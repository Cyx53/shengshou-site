import Link from "next/link";
import { notFound } from "next/navigation";
import { createAlbumAction } from "@/app/actions";
import { AlbumForm } from "@/components/AlbumForm";
import { canPublish, requireUser } from "@/lib/auth";

export default async function NewAlbumPage() {
  const user = await requireUser();
  if (!canPublish(user.role)) notFound();

  return (
    <div className="stack">
      <section className="page-header">
        <div>
          <p className="pill">创建心路</p>
          <h1 className="page-title">新建相册</h1>
        </div>
        <Link className="button secondary" href="/memories">
          返回列表
        </Link>
      </section>

      <section className="form-panel full-editor-panel">
        <AlbumForm action={createAlbumAction} submitLabel="创建相册" />
      </section>
    </div>
  );
}
