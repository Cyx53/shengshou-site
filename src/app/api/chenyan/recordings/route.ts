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

function redirectTo(path: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: path },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return redirectTo("/login");
  if (!canAdmin(user.role)) return redirectTo("/chenyan");

  const formData = await request.formData();
  const files = formData
    .getAll("files")
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (files.length === 0) {
    return redirectTo("/chenyan/recordings/new");
  }

  const title = stringValue(formData, "title");
  const description = stringValue(formData, "description") || null;
  const notes = stringValue(formData, "notes") || null;
  const savedFiles = [];

  for (const file of files) {
    const audioUrl = await saveAudioUpload(file);
    savedFiles.push({
      title: file.name.replace(/\.[^.]+$/, ""),
      audioUrl,
    });
  }

  const session = await prisma.callSession.create({
    data: {
      title: title || (files.length === 1 ? savedFiles[0].title : `通话记录 ${new Date().toLocaleDateString("zh-CN")}`),
      description,
      notes,
      uploaderId: user.id,
      recordings: {
        create: savedFiles.map((file) => ({
          ...file,
          uploaderId: user.id,
        })),
      },
    },
  });

  revalidatePath("/chenyan");
  return redirectTo(`/chenyan/calls/${session.id}`);
}
