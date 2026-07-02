import Link from "next/link";
import { notFound } from "next/navigation";
import { PostSection } from "@prisma/client";
import { deletePostAction, updatePostAction } from "@/app/actions";
import { PostEditorForm } from "@/components/PostEditorForm";
import { canAdmin, canPublish, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id } });

  if (!post || post.section !== PostSection.BLOG) notFound();
  const canManage = canPublish(user.role) && (canAdmin(user.role) || post.authorId === user.id);
  if (!canManage) notFound();

  return (
    <div className="stack">
      <section className="page-header">
        <div>
          <p className="pill">{post.status === "PUBLISHED" ? "已发布" : "草稿"}</p>
          <h1 className="page-title">编辑文章</h1>
        </div>
        <Link className="button secondary" href={`/blog/${post.id}`}>
          返回文章
        </Link>
      </section>

      <section className="form-panel full-editor-panel">
        <PostEditorForm
          action={updatePostAction}
          section={PostSection.BLOG}
          submitLabel="保存修改"
          post={post}
        />
        <form action={deletePostAction} className="danger-zone">
          <input type="hidden" name="postId" value={post.id} />
          <button className="button warn" type="submit">
            删除文章
          </button>
        </form>
      </section>
    </div>
  );
}
