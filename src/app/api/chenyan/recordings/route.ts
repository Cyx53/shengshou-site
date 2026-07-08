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

  for (const file of files) {
    const audioUrl = await saveAudioUpload(file);
    await prisma.callRecording.create({
      data: {
        title: files.length === 1 && title ? title : file.name.replace(/\.[^.]+$/, ""),
        description,
        audioUrl,
        uploaderId: user.id,
      },
    });
  }

  revalidatePath("/chenyan");
  return redirectTo("/chenyan");
}
