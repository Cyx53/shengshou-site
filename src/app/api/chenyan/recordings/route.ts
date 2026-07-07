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
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return redirectTo("/chenyan/recordings/new");
  }

  const audioUrl = await saveAudioUpload(file);
  await prisma.callRecording.create({
    data: {
      title: stringValue(formData, "title") || file.name.replace(/\.[^.]+$/, ""),
      description: stringValue(formData, "description") || null,
      audioUrl,
      uploaderId: user.id,
    },
  });

  revalidatePath("/chenyan");
  return redirectTo("/chenyan");
}
