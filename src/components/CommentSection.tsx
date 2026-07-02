import { CommentTarget, Role } from "@prisma/client";
import { createCommentAction, deleteCommentAction } from "@/app/actions";

type Comment = {
  id: string;
  body: string;
  parentId: string | null;
  createdAt: Date;
  authorId: string;
  author: {
    displayName: string;
  };
};

type CurrentUser = {
  id: string;
  role: Role;
};

function CommentForm({
  targetType,
  targetId,
  returnTo,
  parentId,
  label,
  compact = false,
}: {
  targetType: CommentTarget;
  targetId: string;
  returnTo: string;
  parentId?: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <form action={createCommentAction} className={compact ? "comment-form compact-comment-form" : "comment-form"}>
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <label>
        {label}
        <textarea name="body" required rows={compact ? 2 : 3} placeholder="写点什么..." />
      </label>
      <button className="button small" type="submit">
        {compact ? "回复" : "发送"}
      </button>
    </form>
  );
}

export function CommentSection({
  title = "评论",
  comments,
  currentUser,
  targetType,
  targetId,
  returnTo,
}: {
  title?: string;
  comments: Comment[];
  currentUser: CurrentUser;
  targetType: CommentTarget;
  targetId: string;
  returnTo: string;
}) {
  const roots = comments.filter((comment) => !comment.parentId);
  const replies = new Map<string, Comment[]>();

  for (const comment of comments) {
    if (!comment.parentId) continue;
    replies.set(comment.parentId, [...(replies.get(comment.parentId) ?? []), comment]);
  }

  return (
    <section className="comment-section">
      <div className="comment-section-head">
        <h2>{title}</h2>
        <span>{comments.length} 条</span>
      </div>
      <div className="comment-composer">
        <CommentForm
          targetType={targetType}
          targetId={targetId}
          returnTo={returnTo}
          label="添加评论"
        />
      </div>
      <div className="comments">
        {roots.length === 0 ? <p className="muted">还没有评论。</p> : null}
        {roots.map((comment) => (
          <article className="comment" key={comment.id}>
            <div className="comment-head">
              <span>{comment.author.displayName}</span>
              <span>{comment.createdAt.toLocaleString("zh-CN")}</span>
            </div>
            <p>{comment.body}</p>
            <div className="comment-tools">
              <details className="reply-box">
                <summary>回复</summary>
                <CommentForm
                  targetType={targetType}
                  targetId={targetId}
                  returnTo={returnTo}
                  parentId={comment.id}
                  label="回复"
                  compact
                />
              </details>
              {currentUser.role === "ADMIN" || currentUser.id === comment.authorId ? (
                <form action={deleteCommentAction}>
                  <input type="hidden" name="commentId" value={comment.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button className="text-danger" type="submit">
                    删除
                  </button>
                </form>
              ) : null}
            </div>
            {(replies.get(comment.id) ?? []).map((reply) => (
              <article className="comment reply" key={reply.id}>
                <div className="comment-head">
                  <span>{reply.author.displayName}</span>
                  <span>{reply.createdAt.toLocaleString("zh-CN")}</span>
                </div>
                <p>{reply.body}</p>
                {currentUser.role === "ADMIN" || currentUser.id === reply.authorId ? (
                  <form action={deleteCommentAction} className="comment-tools">
                    <input type="hidden" name="commentId" value={reply.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button className="text-danger" type="submit">
                      删除
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}
