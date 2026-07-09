import path from "path";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { canAdmin, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveAudioUpload } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  if (!canAdmin(user.role)) return NextResponse.json({ error: "没有权限。" }, { status: 403 });

  const { id } = await params;
  const session = await prisma.callSession.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!session) return NextResponse.json({ error: "通话不存在。" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "请选择录音文件。" }, { status: 400 });
  }

  try {
    const audioUrl = await saveAudioUpload(file);
    const title = stringValue(formData, "title") || file.name.replace(/\.[^.]+$/, "");
    const relativePath = stringValue(formData, "relativePath");
    const description = relativePath && relativePath !== file.name ? relativePath : null;

    const recording = await prisma.callRecording.create({
      data: {
        title: path.basename(title),
        description,
        audioUrl,
        sessionId: session.id,
        uploaderId: user.id,
      },
      select: { id: true },
    });

    revalidatePath("/chenyan");
    revalidatePath(`/chenyan/calls/${session.id}`);
    return NextResponse.json(recording);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "录音上传失败。" },
      { status: 400 },
    );
  }
}
