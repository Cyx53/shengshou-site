import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const params = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="pill">登录访问</p>
        <h1>圣兽祇园</h1>
        <p className="muted">登录后进入文以载道、谦爱集、心路和观道观。</p>
        {params.error ? <p className="error">账号或密码不正确。</p> : null}
        <form action={loginAction} className="form-grid">
          <label>
            账号
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            密码
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="button" type="submit">
            登录
          </button>
        </form>
      </section>
    </main>
  );
}
