import bcrypt from "bcryptjs";
import { PrismaClient, Role, PostSection, PostStatus, MediaKind } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "admin123456");
  if (!initialPassword) {
    throw new Error("INITIAL_ADMIN_PASSWORD is required in production.");
  }

  const passwordHash = await bcrypt.hash(initialPassword, 12);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      displayName: "管理员",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  await prisma.post.upsert({
    where: { id: "seed-welcome-post" },
    update: {},
    create: {
      id: "seed-welcome-post",
      title: "第一篇日志",
      excerpt: "这是圣兽祇园的一期样例文章。",
      content:
        "这里可以记录动态、长文、复盘和公告。内容通过账号登录来控制访问。",
      status: PostStatus.PUBLISHED,
      section: PostSection.BLOG,
      authorId: admin.id,
    },
  });

  await prisma.memoryAlbum.upsert({
    where: { id: "seed-memory-album" },
    update: {
      title: "这是我们的来时路",
    },
    create: {
      id: "seed-memory-album",
      title: "这是我们的来时路",
      description: "之后可以在这里集中保存照片、视频和大家的评论。",
      items: {
        create: {
          title: "样例照片占位",
          kind: MediaKind.PHOTO,
          mediaUrl: "https://images.unsplash.com/photo-1519681393784-d120267933ba",
          description: "上传真实照片后可以替换掉这个占位内容。",
        },
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
