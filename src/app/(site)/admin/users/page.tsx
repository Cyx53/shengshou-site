import { createUserAction, updateUserAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function UsersPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return <p className="error">只有管理员可以访问用户管理。</p>;
  }

  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="two-col">
      <section className="stack">
        <h1 className="page-title">用户</h1>
        {users.map((member) => (
          <article className="content-card" key={member.id}>
            <h2>{member.displayName}</h2>
            <p className="muted">
              {member.username} · {member.role} · {member.isActive ? "启用" : "停用"}
            </p>
            <form action={updateUserAction} className="compact-form">
              <input type="hidden" name="userId" value={member.id} />
              <label>
                昵称
                <input name="displayName" defaultValue={member.displayName} required />
              </label>
              <label>
                角色
                <select name="role" defaultValue={member.role}>
                  <option value="VIEWER">访客</option>
                  <option value="PUBLISHER">发布者</option>
                  <option value="ADMIN">管理员</option>
                </select>
              </label>
              <label className="check-row">
                <input name="isActive" type="checkbox" defaultChecked={member.isActive} />
                启用
              </label>
              <button className="button secondary" type="submit">
                更新用户
              </button>
            </form>
          </article>
        ))}
      </section>
      <aside className="form-panel">
        <h2>创建用户</h2>
        <form action={createUserAction} className="form-grid">
          <label>
            账号
            <input name="username" required />
          </label>
          <label>
            昵称
            <input name="displayName" required />
          </label>
          <label>
            密码
            <input name="password" type="password" minLength={8} required />
          </label>
          <label>
            角色
            <select name="role" defaultValue="VIEWER">
              <option value="VIEWER">访客</option>
              <option value="PUBLISHER">发布者</option>
              <option value="ADMIN">管理员</option>
            </select>
          </label>
          <button className="button" type="submit">
            创建
          </button>
        </form>
      </aside>
    </div>
  );
}
