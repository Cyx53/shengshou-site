import Link from "next/link";
import { canPublish, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function MemoriesPage() {
  const user = await requireUser();
  const albums = await prisma.memoryAlbum.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="stack">
      <section className="page-header">
        <div>
          <p className="pill">相册列表</p>
          <h1 className="page-title">心路</h1>
        </div>
        {canPublish(user.role) ? (
          <Link className="button" href="/memories/new">
            新建相册
          </Link>
        ) : null}
      </section>

      <section className="grid">
        {albums.length === 0 ? (
          <article className="content-card empty-state">
            <h2>还没有相册</h2>
            <p className="muted">创建后的心路相册会出现在这里。</p>
          </article>
        ) : null}

        {albums.map((album) => (
          <Link className="content-card" href={`/memories/${album.id}`} key={album.id}>
            <h2>{album.title}</h2>
            <p className="muted">{album.description || "暂无描述"}</p>
            <p className="muted">{album._count.items} 个照片/视频</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
