import { PostSection } from "@prisma/client";
import { RichTextEditor } from "@/components/RichTextEditor";

type PostEditorFormProps = {
  action: (formData: FormData) => Promise<void>;
  section: PostSection;
  submitLabel: string;
  post?: {
    id: string;
    title: string;
    excerpt: string | null;
    coverUrl: string | null;
    content: string;
    status: "DRAFT" | "PUBLISHED";
    section?: PostSection;
  };
};

export function PostEditorForm({
  action,
  section,
  submitLabel,
  post,
}: PostEditorFormProps) {
  return (
    <form action={action} className="form-grid">
      <input type="hidden" name="section" value={section} />
      {post ? <input type="hidden" name="postId" value={post.id} /> : null}
      <label>
        标题
        <input name="title" defaultValue={post?.title ?? ""} required />
      </label>
      <label>
        摘要
        <input name="excerpt" defaultValue={post?.excerpt ?? ""} />
      </label>
      <label>
        封面地址
        <input name="coverUrl" defaultValue={post?.coverUrl ?? ""} placeholder="可先留空" />
      </label>
      <RichTextEditor name="content" initialValue={post?.content ?? ""} />
      <label>
        状态
        <select name="status" defaultValue={post?.status ?? "PUBLISHED"}>
          <option value="PUBLISHED">发布</option>
          <option value="DRAFT">草稿</option>
        </select>
      </label>
      <button className="button" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
