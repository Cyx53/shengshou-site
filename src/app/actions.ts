"use server";

import bcrypt from "bcryptjs";
import {
  BookFormat,
  CommentTarget,
  PostSection,
  PostStatus,
  ReadingRecordKind,
  Role,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canAdmin,
  canPublish,
  clearSession,
  requireUser,
  setSession,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractPdfToc } from "@/lib/pdf-toc";
import { deleteUploadByUrl, saveBookUpload, saveImageUpload, saveUpload } from "@/lib/upload";

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalDate(value: string) {
  return value ? new Date(value) : undefined;
}

function optionalInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function postStatus(value: string) {
  return value === "DRAFT" ? PostStatus.DRAFT : PostStatus.PUBLISHED;
}

function postSection(value: string) {
  if (value === "CHENYAN") return PostSection.CHENYAN;
  return value === "QIANAI" ? PostSection.QIANAI : PostSection.BLOG;
}

function sectionPath(section: PostSection) {
  if (section === "CHENYAN") return "/chenyan";
  return section === "QIANAI" ? "/qianai" : "/blog";
}

function readingRecordKind(value: string) {
  if (value === "HIGHLIGHT") return ReadingRecordKind.HIGHLIGHT;
  if (value === "BOOKMARK") return ReadingRecordKind.BOOKMARK;
  if (value === "REFLECTION") return ReadingRecordKind.REFLECTION;
  return ReadingRecordKind.NOTE;
}

const PDF_TOC_AUTO_EXTRACT_LIMIT = 80 * 1024 * 1024;

function tocLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      title: line.replace(/^\d+[\.、\s-]*/, ""),
      position: index + 1,
      locator: `${index + 1}`,
    }));
}

async function assertCanManagePost(postId: string, userId: string, role: Role) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new Error("Post not found.");
  if (!canAdmin(role) && post.authorId !== userId) {
    throw new Error("You can only manage your own posts.");
  }
  return post;
}

async function assertCanManageCreativeWork(workId: string, userId: string, role: Role) {
  const work = await prisma.creativeWork.findUnique({ where: { id: workId } });
  if (!work) throw new Error("Creative work not found.");
  if (!canAdmin(role) && (!canPublish(role) || work.authorId !== userId)) {
    throw new Error("You can only manage your own creative work.");
  }
  return work;
}

export async function loginAction(formData: FormData) {
  const username = stringValue(formData, "username");
  const password = stringValue(formData, "password");

  const user = await prisma.user.findFirst({
    where: { username, isActive: true },
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect("/login?error=1");
  }

  await setSession(user.id, user.role);
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function createPostAction(formData: FormData) {
  const user = await requireUser();
  if (!canPublish(user.role)) throw new Error("No permission to publish.");
  const section = postSection(stringValue(formData, "section"));
  if (section === "CHENYAN" && !canAdmin(user.role)) {
    throw new Error("Only admins can publish in this section.");
  }

  await prisma.post.create({
    data: {
      title: stringValue(formData, "title"),
      excerpt: stringValue(formData, "excerpt") || null,
      content: stringValue(formData, "content"),
      coverUrl: stringValue(formData, "coverUrl") || null,
      status: postStatus(stringValue(formData, "status")),
      section,
      authorId: user.id,
    },
  });

  revalidatePath(sectionPath(section));
  redirect(sectionPath(section));
}

export async function updatePostAction(formData: FormData) {
  const user = await requireUser();
  if (!canPublish(user.role)) throw new Error("No permission to edit posts.");

  const postId = stringValue(formData, "postId");
  const post = await assertCanManagePost(postId, user.id, user.role);
  const section = postSection(stringValue(formData, "section") || post.section);
  if ((post.section === "CHENYAN" || section === "CHENYAN") && !canAdmin(user.role)) {
    throw new Error("Only admins can edit this section.");
  }

  await prisma.post.update({
    where: { id: postId },
    data: {
      title: stringValue(formData, "title"),
      excerpt: stringValue(formData, "excerpt") || null,
      content: stringValue(formData, "content"),
      coverUrl: stringValue(formData, "coverUrl") || null,
      status: postStatus(stringValue(formData, "status")),
      section,
    },
  });

  revalidatePath("/blog");
  revalidatePath("/qianai");
  revalidatePath("/chenyan");
  revalidatePath(`${sectionPath(section)}/${postId}`);
  redirect(`${sectionPath(section)}/${postId}`);
}

export async function deletePostAction(formData: FormData) {
  const user = await requireUser();
  if (!canPublish(user.role)) throw new Error("No permission to delete posts.");

  const postId = stringValue(formData, "postId");
  const post = await assertCanManagePost(postId, user.id, user.role);
  if (post.section === "CHENYAN" && !canAdmin(user.role)) {
    throw new Error("Only admins can delete this section.");
  }

  await prisma.comment.deleteMany({
    where: { targetType: "POST", targetId: postId },
  });
  await prisma.post.delete({ where: { id: postId } });

  revalidatePath("/blog");
  revalidatePath("/qianai");
  revalidatePath("/chenyan");
  redirect(sectionPath(post.section));
}

export async function createAlbumAction(formData: FormData) {
  const user = await requireUser();
  if (!canPublish(user.role)) throw new Error("No permission to create albums.");

  await prisma.memoryAlbum.create({
    data: {
      title: stringValue(formData, "title"),
      description: stringValue(formData, "description") || null,
      coverUrl: stringValue(formData, "coverUrl") || null,
      eventDate: optionalDate(stringValue(formData, "eventDate")),
    },
  });

  revalidatePath("/memories");
  redirect("/memories");
}

export async function updateAlbumAction(formData: FormData) {
  const user = await requireUser();
  if (!canPublish(user.role)) throw new Error("No permission to edit albums.");

  const albumId = stringValue(formData, "albumId");
  await prisma.memoryAlbum.update({
    where: { id: albumId },
    data: {
      title: stringValue(formData, "title"),
      description: stringValue(formData, "description") || null,
      coverUrl: stringValue(formData, "coverUrl") || null,
      eventDate: optionalDate(stringValue(formData, "eventDate")),
    },
  });

  revalidatePath("/memories");
  revalidatePath(`/memories/${albumId}`);
  redirect(`/memories/${albumId}`);
}

export async function deleteAlbumAction(formData: FormData) {
  const user = await requireUser();
  if (!canPublish(user.role)) throw new Error("No permission to delete albums.");

  const albumId = stringValue(formData, "albumId");
  const items = await prisma.memoryItem.findMany({
    where: { albumId },
    select: { id: true },
  });

  await prisma.comment.deleteMany({
    where: {
      OR: [
        { targetType: "MEMORY_ALBUM", targetId: albumId },
        {
          targetType: "MEMORY_ITEM",
          targetId: { in: items.map((item) => item.id) },
        },
      ],
    },
  });
  await prisma.memoryAlbum.delete({ where: { id: albumId } });

  revalidatePath("/memories");
  redirect("/memories");
}

export async function uploadMemoryItemAction(formData: FormData) {
  const user = await requireUser();
  if (!canPublish(user.role)) throw new Error("No permission to upload.");

  const albumId = stringValue(formData, "albumId");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please choose a photo or video.");
  }

  const upload = await saveUpload(file);

  await prisma.memoryItem.create({
    data: {
      albumId,
      title: stringValue(formData, "title") || file.name,
      description: stringValue(formData, "description") || null,
      kind: upload.kind,
      mediaUrl: upload.url,
      takenAt: optionalDate(stringValue(formData, "takenAt")),
    },
  });

  revalidatePath(`/memories/${albumId}`);
  redirect(`/memories/${albumId}`);
}

export async function updateMemoryItemAction(formData: FormData) {
  const user = await requireUser();
  if (!canPublish(user.role)) throw new Error("No permission to edit media.");

  const itemId = stringValue(formData, "itemId");
  const item = await prisma.memoryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Media item not found.");

  await prisma.memoryItem.update({
    where: { id: itemId },
    data: {
      title: stringValue(formData, "title"),
      description: stringValue(formData, "description") || null,
      takenAt: optionalDate(stringValue(formData, "takenAt")),
    },
  });

  revalidatePath(`/memories/${item.albumId}`);
  revalidatePath(`/memories/${item.albumId}/${item.id}`);
  redirect(`/memories/${item.albumId}/${item.id}`);
}

export async function deleteMemoryItemAction(formData: FormData) {
  const user = await requireUser();
  if (!canPublish(user.role)) throw new Error("No permission to delete media.");

  const itemId = stringValue(formData, "itemId");
  const item = await prisma.memoryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Media item not found.");

  await prisma.comment.deleteMany({
    where: { targetType: "MEMORY_ITEM", targetId: item.id },
  });
  await prisma.memoryItem.delete({ where: { id: item.id } });

  revalidatePath(`/memories/${item.albumId}`);
  redirect(`/memories/${item.albumId}`);
}

export async function createBookAction(formData: FormData) {
  const user = await requireUser();
  if (!canPublish(user.role)) throw new Error("No permission to upload books.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please choose a PDF, EPUB or TXT file.");
  }

  const upload = await saveBookUpload(file);
  const coverFile = formData.get("coverFile");
  const coverUrl =
    coverFile instanceof File && coverFile.size > 0
      ? await saveImageUpload(coverFile)
      : stringValue(formData, "coverUrl") || null;
  const manualChapters = tocLines(stringValue(formData, "toc"));
  const detectedChapters =
    upload.format === "PDF" && file.size <= PDF_TOC_AUTO_EXTRACT_LIMIT
      ? await extractPdfToc(upload.path).catch(() => [])
      : [];
  const chapters = detectedChapters.length > 0 ? detectedChapters : manualChapters;

  const book = await prisma.book.create({
    data: {
      title: stringValue(formData, "title") || file.name.replace(/\.[^.]+$/, ""),
      author: stringValue(formData, "author") || null,
      description: stringValue(formData, "description") || null,
      coverUrl,
      fileUrl: upload.url,
      format: upload.format as BookFormat,
      sourceUrl: stringValue(formData, "sourceUrl") || null,
      uploaderId: user.id,
      chapters: chapters.length ? { create: chapters } : undefined,
    },
  });

  revalidatePath("/guandaoguan");
  redirect(`/guandaoguan/books/${book.id}`);
}

export async function createReadingRecordAction(formData: FormData) {
  const user = await requireUser();
  const bookId = stringValue(formData, "bookId");
  const returnTo = stringValue(formData, "returnTo") || `/guandaoguan/books/${bookId}`;
  const revalidateTarget = returnTo.split("?")[0] || returnTo;
  const body = stringValue(formData, "body");

  if (!body) throw new Error("Record cannot be empty.");

  await prisma.readingRecord.create({
    data: {
      bookId,
      userId: user.id,
      chapterId: stringValue(formData, "chapterId") || null,
      parentRecordId: stringValue(formData, "parentRecordId") || null,
      kind: readingRecordKind(stringValue(formData, "kind")),
      quote: stringValue(formData, "quote") || null,
      locator: stringValue(formData, "locator") || null,
      pageNumber: optionalInt(stringValue(formData, "pageNumber")),
      annotationStyle: stringValue(formData, "annotationStyle") || null,
      color: stringValue(formData, "color") || null,
      rects: stringValue(formData, "rects") || null,
      body,
    },
  });

  revalidatePath(revalidateTarget);
  redirect(returnTo);
}

export async function deleteReadingRecordAction(formData: FormData) {
  const user = await requireUser();
  const recordId = stringValue(formData, "recordId");
  const record = await prisma.readingRecord.findUnique({
    where: { id: recordId },
    select: { bookId: true, userId: true },
  });
  const returnTo = stringValue(formData, "returnTo") || (record ? `/guandaoguan/books/${record.bookId}` : "/guandaoguan");
  const revalidateTarget = returnTo.split("?")[0] || returnTo;

  if (!record) {
    revalidatePath(revalidateTarget);
    redirect(returnTo);
  }

  if (!canAdmin(user.role) && record.userId !== user.id) {
    throw new Error("You can only delete your own reading records.");
  }

  await prisma.readingRecord.deleteMany({ where: { parentRecordId: recordId } });
  await prisma.readingRecord.deleteMany({ where: { id: recordId } });

  revalidatePath(revalidateTarget);
  redirect(returnTo);
}

export async function createCreativeWorkAction(formData: FormData) {
  const user = await requireUser();
  if (!canPublish(user.role)) throw new Error("No permission to create creative works.");

  const coverFile = formData.get("coverFile");
  const coverUrl =
    coverFile instanceof File && coverFile.size > 0
      ? await saveImageUpload(coverFile)
      : stringValue(formData, "coverUrl") || null;

  const work = await prisma.creativeWork.create({
    data: {
      title: stringValue(formData, "title"),
      synopsis: stringValue(formData, "synopsis") || null,
      coverUrl,
      authorId: user.id,
    },
  });

  revalidatePath("/guandaoguan/studio");
  redirect(`/guandaoguan/studio/${work.id}`);
}

export async function createCreativeChapterAction(formData: FormData) {
  const user = await requireUser();
  if (!canPublish(user.role)) throw new Error("No permission to write creative works.");
  const workId = stringValue(formData, "workId");
  const work = await prisma.creativeWork.findUnique({
    where: { id: workId },
    include: { _count: { select: { chapters: true } } },
  });

  if (!work) throw new Error("Work not found.");
  if (!canAdmin(user.role) && work.authorId !== user.id) {
    throw new Error("You can only write in your own creative work.");
  }

  await prisma.creativeChapter.create({
    data: {
      workId,
      title: stringValue(formData, "title"),
      content: stringValue(formData, "content"),
      position: work._count.chapters + 1,
    },
  });

  revalidatePath(`/guandaoguan/studio/${workId}`);
  redirect(`/guandaoguan/studio/${workId}`);
}

export async function updateCreativeChapterAction(formData: FormData) {
  const user = await requireUser();
  if (!canPublish(user.role)) throw new Error("No permission to edit creative works.");
  const chapterId = stringValue(formData, "chapterId");
  const chapter = await prisma.creativeChapter.findUnique({
    where: { id: chapterId },
    include: { work: true },
  });

  if (!chapter) throw new Error("Creative chapter not found.");
  if (!canAdmin(user.role) && chapter.work.authorId !== user.id) {
    throw new Error("You can only edit chapters in your own creative work.");
  }

  await prisma.$transaction([
    prisma.creativeChapter.update({
      where: { id: chapter.id },
      data: {
        title: stringValue(formData, "title"),
        content: stringValue(formData, "content"),
      },
    }),
    prisma.creativeWork.update({
      where: { id: chapter.workId },
      data: { updatedAt: new Date() },
    }),
  ]);

  revalidatePath(`/guandaoguan/studio/${chapter.workId}`);
  redirect(`/guandaoguan/studio/${chapter.workId}?chapter=${chapter.id}`);
}

export async function deleteCreativeWorkAction(formData: FormData) {
  const user = await requireUser();
  const workId = stringValue(formData, "workId");

  await assertCanManageCreativeWork(workId, user.id, user.role);
  await prisma.creativeWork.delete({ where: { id: workId } });

  revalidatePath("/guandaoguan");
  revalidatePath("/guandaoguan/studio");
  redirect("/guandaoguan/studio");
}

export async function deleteCreativeChapterAction(formData: FormData) {
  const user = await requireUser();
  if (!canPublish(user.role)) throw new Error("No permission to delete creative chapters.");
  const chapterId = stringValue(formData, "chapterId");
  const chapter = await prisma.creativeChapter.findUnique({
    where: { id: chapterId },
    include: { work: true },
  });

  if (!chapter) throw new Error("Creative chapter not found.");
  if (!canAdmin(user.role) && chapter.work.authorId !== user.id) {
    throw new Error("You can only manage chapters in your own creative work.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.creativeChapter.delete({ where: { id: chapter.id } });
    const remaining = await tx.creativeChapter.findMany({
      where: { workId: chapter.workId },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    await Promise.all(
      remaining.map((item, index) =>
        tx.creativeChapter.update({
          where: { id: item.id },
          data: { position: index + 1 },
        }),
      ),
    );
  });

  revalidatePath(`/guandaoguan/studio/${chapter.workId}`);
  redirect(`/guandaoguan/studio/${chapter.workId}`);
}

export async function createCommentAction(formData: FormData) {
  const user = await requireUser();
  const targetType = stringValue(formData, "targetType") as CommentTarget;
  const targetId = stringValue(formData, "targetId");
  const parentId = stringValue(formData, "parentId") || null;
  const returnTo = stringValue(formData, "returnTo") || "/";
  const body = stringValue(formData, "body");

  if (!body) throw new Error("Comment cannot be empty.");

  await prisma.comment.create({
    data: { authorId: user.id, targetType, targetId, parentId, body },
  });

  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function deleteCallRecordingAction(formData: FormData) {
  const user = await requireUser();
  if (!canAdmin(user.role)) throw new Error("Only admins can delete call recordings.");

  const recordingId = stringValue(formData, "recordingId");
  const recording = await prisma.callRecording.findUnique({ where: { id: recordingId } });
  if (!recording) redirect("/chenyan");

  await prisma.comment.deleteMany({
    where: { targetType: "CALL_RECORDING", targetId: recording.id },
  });
  await prisma.callRecording.delete({ where: { id: recording.id } });
  await deleteUploadByUrl(recording.audioUrl);

  revalidatePath("/chenyan");
  redirect("/chenyan");
}

export async function deleteCommentAction(formData: FormData) {
  const user = await requireUser();
  const commentId = stringValue(formData, "commentId");
  const returnTo = stringValue(formData, "returnTo") || "/";

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) redirect(returnTo);

  if (!canAdmin(user.role) && comment.authorId !== user.id) {
    throw new Error("You can only delete your own comments.");
  }

  await prisma.comment.update({
    where: { id: commentId },
    data: { status: "HIDDEN" },
  });
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function createUserAction(formData: FormData) {
  const user = await requireUser();
  if (!canAdmin(user.role)) throw new Error("Only admins can create users.");

  const password = stringValue(formData, "password");
  await prisma.user.create({
    data: {
      username: stringValue(formData, "username"),
      displayName: stringValue(formData, "displayName"),
      role: stringValue(formData, "role") as Role,
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function updateUserAction(formData: FormData) {
  const user = await requireUser();
  if (!canAdmin(user.role)) throw new Error("Only admins can update users.");

  const targetUserId = stringValue(formData, "userId");
  const isSelf = targetUserId === user.id;

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      displayName: stringValue(formData, "displayName"),
      role: isSelf ? "ADMIN" : (stringValue(formData, "role") as Role),
      isActive: isSelf ? true : stringValue(formData, "isActive") === "on",
    },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}
