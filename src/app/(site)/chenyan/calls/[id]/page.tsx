import Link from "next/link";
import { CommentStatus, CommentTarget } from "@prisma/client";
import { notFound } from "next/navigation";
import {
  deleteCallRecordingAction,
  deleteCallSessionAction,
  updateCallSessionNotesAction,
} from "@/app/actions";
import { CommentSection } from "@/components/CommentSection";
import { canAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CallSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canAdmin(user.role)) notFound();

  const { id } = await params;
  const session = await prisma.callSession.findUnique({
    where: { id },
    include: {
      uploader: { select: { displayName: true } },
      recordings: {
        orderBy: { createdAt: "asc" },
        include: { uploader: { select: { displayName: true } } },
      },
    },
  });
  if (!session) notFound();

  const recordingIds = session.recordings.map((recording) => recording.id);
  const comments = await prisma.comment.findMany({
    where: {
      status: CommentStatus.PUBLISHED,
      OR: [
        { targetType: CommentTarget.CALL_SESSION, targetId: session.id },
        {
          targetType: CommentTarget.CALL_RECORDING,
          targetId: { in: recordingIds },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { displayName: true } } },
  });

  const sessionComments = comments.filter(
    (comment) => comment.targetType === CommentTarget.CALL_SESSION,
  );
  const commentsByRecording = new Map<string, typeof comments>();
  for (const comment of comments) {
    if (comment.targetType !== CommentTarget.CALL_RECORDING) continue;
    commentsByRecording.set(comment.targetId, [
      ...(commentsByRecording.get(comment.targetId) ?? []),
      comment,
    ]);
  }

  const returnTo = `/chenyan/calls/${session.id}`;

  return (
    <div className="stack call-detail">
      <section className="page-header">
        <div>
          <p className="pill">通话档案 · {session.recordings.length} 条录音</p>
          <h1 className="page-title">{session.title}</h1>
          <p className="muted">
            {session.createdAt.toLocaleString("zh-CN")} · 整理人：{session.uploader.displayName}
          </p>
        </div>
        <div className="article-actions">
          <Link className="button secondary" href="/chenyan">
            返回陈言普语
          </Link>
          <form action={deleteCallSessionAction}>
            <input type="hidden" name="sessionId" value={session.id} />
            <button className="button secondary danger-button" type="submit">
              删除本次通话
            </button>
          </form>
        </div>
      </section>

      {session.description ? (
        <article className="content-card call-summary">
          <p className="pill">通话说明</p>
          <p>{session.description}</p>
        </article>
      ) : null}

      <section className="content-card call-notes">
        <div className="section-heading">
          <p className="pill">通话笔记</p>
          <h2>整理这次谈话</h2>
        </div>
        <form action={updateCallSessionNotesAction} className="form-grid">
          <input type="hidden" name="sessionId" value={session.id} />
          <label>
            笔记内容
            <textarea
              name="notes"
              rows={8}
              defaultValue={session.notes ?? ""}
              placeholder="记录这次通话的要点、感受和后续事项..."
            />
          </label>
          <button className="button" type="submit">
            保存通话笔记
          </button>
        </form>
      </section>

      <CommentSection
        title="本次通话的评论"
        comments={sessionComments}
        currentUser={user}
        targetType={CommentTarget.CALL_SESSION}
        targetId={session.id}
        returnTo={returnTo}
      />

      <section className="stack">
        <div className="section-heading">
          <p className="pill">录音明细</p>
          <h2>逐条收听与评论</h2>
        </div>
        {session.recordings.map((recording, index) => (
          <article className="content-card recording-card" key={recording.id}>
            <div className="post-card-head">
              <span className="pill">第 {index + 1} 条</span>
              <span className="muted">{recording.createdAt.toLocaleString("zh-CN")}</span>
            </div>
            <div className="recording-title-row">
              <h2>{recording.title}</h2>
              <form action={deleteCallRecordingAction}>
                <input type="hidden" name="recordingId" value={recording.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button className="text-danger" type="submit">
                  删除这条录音
                </button>
              </form>
            </div>
            {recording.description ? <p className="muted">{recording.description}</p> : null}
            <audio controls preload="metadata" src={recording.audioUrl} />
            <CommentSection
              title="这条录音的评论"
              comments={commentsByRecording.get(recording.id) ?? []}
              currentUser={user}
              targetType={CommentTarget.CALL_RECORDING}
              targetId={recording.id}
              returnTo={returnTo}
            />
          </article>
        ))}
      </section>
    </div>
  );
}
