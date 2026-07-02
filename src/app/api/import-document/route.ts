import { NextResponse } from "next/server";
import { docxToHtml, markdownToHtml } from "@/lib/document-import";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".md") || name.endsWith(".markdown")) {
    return NextResponse.json({
      html: markdownToHtml(buffer.toString("utf8")),
    });
  }

  if (name.endsWith(".docx")) {
    return NextResponse.json({
      html: await docxToHtml(buffer),
    });
  }

  return NextResponse.json(
    { error: "Only .docx, .md and .markdown files are supported." },
    { status: 400 },
  );
}
