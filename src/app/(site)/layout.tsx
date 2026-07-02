import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label="站点导航">
        <nav className="rail-nav">
          <Link href="/">首页</Link>
          <Link href="/blog">文以载道</Link>
          <Link href="/qianai">谦爱集</Link>
          <Link href="/memories">心路</Link>
          <Link href="/guandaoguan">观道观</Link>
          {user.role === "ADMIN" ? <Link href="/admin/users">用户</Link> : null}
        </nav>
        <div className="rail-account">
          <span className="pill">{user.displayName}</span>
          <form action={logoutAction}>
            <button className="link-button" type="submit">
              退出
            </button>
          </form>
        </div>
      </aside>
      <main className="container">{children}</main>
    </div>
  );
}
