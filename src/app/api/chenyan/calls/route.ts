import { NextResponse } from "next/server";
import { canAdmin, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  if (!canAdmin(user.role)) return NextResponse.json({ error: "没有权限。" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    description?: string;
    notes?: string;
  };
  const title = body.title?.trim() || `通话记录 ${new Date().toLocaleDateString("zh-CN")}`;

  const session = await prisma.callSession.create({
    data: {
      title,
      description: body.description?.trim() || null,
      notes: body.notes?.trim() || null,
      uploaderId: user.id,
    },
    select: { id: true },
  });

  return NextResponse.json(session);
}
