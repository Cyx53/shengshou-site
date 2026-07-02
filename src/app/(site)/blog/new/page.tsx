import Link from "next/link";
import { notFound } from "next/navigation";
import { PostSection } from "@prisma/client";
import { createPostAction } from "@/app/actions";
import { PostEditorForm } from "@/components/PostEditorForm";
import { canPublish, requireUser } from "@/lib/auth";

export default async function NewPostPage() {
  const user = await requireUser();
  if (!canPublish(user.role)) notFound();

  return (
    <div className="stack">
      <section className="page-header">
        <div>
          <p className="pill">文以载道</p>
          <h1 className="page-title">发布文章</h1>
        </div>
        <Link className="button secondary" href="/blog">
          返回列表
        </Link>
      </section>

      <section className="form-panel full-editor-panel">
        <PostEditorForm
          action={createPostAction}
          section={PostSection.BLOG}
          submitLabel="保存文章"
        />
      </section>
    </div>
  );
}
