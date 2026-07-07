import type { CSSProperties } from "react";
import Link from "next/link";
import { PostSection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const quotes = [
  "生活不是一种宿命，而是一种选择",
  "前进，不择手段的前进，继承他们的遗志",
  "威远江水日中来，南去，汤汤不知几度",
  "飞升台下威江畔，诗人剑仙在此间",
  "切莫往下看，倍道往上开",
  "鹊桥由仙架，云梯任尔登",
  "风云际会",
  "We are the Saints.",
  "从神圣中来，走向永恒的不朽",
  "从现在开始，我们是同志了",
  "为了圣兽，我们才存在",
];

const sections = [
  { href: "/blog", title: "文以载道", desc: "记事、长文、复盘与宣言" },
  { href: "/qianai", title: "谦爱集", desc: "另一处文章集，收束温柔与锋芒" },
  { href: "/chenyan", title: "陈言普语", desc: "管理员留存的文章与通话录音" },
  { href: "/memories", title: "心路", desc: "照片、视频和共同走过的回忆" },
  { href: "/guandaoguan", title: "观道观", desc: "电子书库、共同阅读与创作空间" },
];

export default async function HomePage() {
  const user = await requireUser();
  const [blogCount, qianaiCount, chenyanCount, albumCount, bookCount] = await Promise.all([
    prisma.post.count({ where: { section: PostSection.BLOG, status: "PUBLISHED" } }),
    prisma.post.count({ where: { section: PostSection.QIANAI, status: "PUBLISHED" } }),
    user.role === "ADMIN"
      ? prisma.post.count({ where: { section: PostSection.CHENYAN } })
      : Promise.resolve(0),
    prisma.memoryAlbum.count(),
    prisma.book.count(),
  ]);

  const counts = new Map([
    ["/blog", `${blogCount} 篇文章`],
    ["/qianai", `${qianaiCount} 篇文章`],
    ["/chenyan", user.role === "ADMIN" ? `${chenyanCount} 篇文章` : "暂无内容"],
    ["/memories", `${albumCount} 个相册`],
    ["/guandaoguan", `${bookCount} 本书`],
  ]);

  return (
    <div className="home-page">
      <img className="home-camellia" src="/assets/camellia-white.png" alt="" />
      <section className="home-hero">
        <p className="pill">当前登录：{user.displayName}</p>
        <h1>圣兽祇园</h1>
        <p>从神圣中来，走向永恒的不朽。</p>
      </section>

      <section className="home-section-grid" aria-label="站内板块">
        {sections.map((section) => (
          <Link className="home-section-card" href={section.href} key={section.href}>
            <span>{counts.get(section.href)}</span>
            <h2>{section.title}</h2>
            <p>{section.desc}</p>
          </Link>
        ))}
      </section>

      <section className="water-quotes" aria-label="祇园浮语">
        {quotes.map((quote, index) => (
          <span
            key={quote}
            style={
              {
                "--i": index,
                "--d": `${10 + (index % 5) * 1.7}s`,
                "--drift": `${8 + (index % 4) * 4}px`,
              } as CSSProperties
            }
          >
            {quote}
          </span>
        ))}
      </section>
    </div>
  );
}
