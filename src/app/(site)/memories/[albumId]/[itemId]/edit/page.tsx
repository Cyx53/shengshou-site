import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteMemoryItemAction, updateMemoryItemAction } from "@/app/actions";
import { MemoryItemForm } from "@/components/MemoryItemForm";
import { canPublish, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditMemoryItemPage({
  params,
}: {
  params: Promise<{ albumId: string; itemId: string }>;
}) {
  const user = await requireUser();
  if (!canPublish(user.role)) notFound();

  const { albumId, itemId } = await params;
  const item = await prisma.memoryItem.findUnique({ where: { id: itemId } });
  if (!item || item.albumId !== albumId) notFound();

  return (
    <div className="stack">
      <section className="page-header">
        <div>
          <p className="pill">{item.kind === "PHOTO" ? "照片" : "视频"}</p>
          <h1 className="page-title">编辑照片/视频</h1>
        </div>
        <Link className="button secondary" href={`/memories/${item.albumId}/${item.id}`}>
          返回详情
        </Link>
      </section>

      <section className="form-panel full-editor-panel">
        <MemoryItemForm action={updateMemoryItemAction} item={item} submitLabel="保存修改" />
        <form action={deleteMemoryItemAction} className="danger-zone">
          <input type="hidden" name="itemId" value={item.id} />
          <button className="button warn" type="submit">
            删除照片/视频
          </button>
        </form>
      </section>
    </div>
  );
}
