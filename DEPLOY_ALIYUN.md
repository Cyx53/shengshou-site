# 阿里云 ECS 部署步骤

## 1. 服务器控制台

1. 等实例状态变成“运行中”。
2. 进入 ECS 实例详情，复制公网 IP。
3. 安全组入方向建议：
   - TCP 22：只允许你的当前公网 IP。
   - TCP 80：允许 0.0.0.0/0。
   - TCP 443：允许 0.0.0.0/0。
   - 不开放 3000。

## 2. 首次登录服务器

```bash
ssh root@你的服务器公网IP
```

更新系统：

```bash
apt update && apt upgrade -y
```

安装常用工具：

```bash
apt install -y git curl ufw gnupg
```

## 3. 安装 Docker 和 Compose

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
docker version
docker compose version
```

## 4. 准备目录

```bash
mkdir -p /srv/shengshou
mkdir -p /data/shengshou/db /data/shengshou/uploads /data/shengshou/backups
```

## 5. 上传代码

如果代码已经推到 GitHub：

```bash
cd /srv
git clone 你的仓库地址 shengshou
cd /srv/shengshou
```

如果还没有 GitHub 仓库，可以先从本地打包上传，之后再改成 GitHub 自动更新。

## 6. 配置生产环境变量

```bash
cp .env.production.example .env.production
nano .env.production
```

至少修改：

```env
DATABASE_URL="file:/data/db/prod.db"
SESSION_SECRET="一串很长的随机字符串"
INITIAL_ADMIN_PASSWORD="你的管理员强密码"
RUN_SEED="true"
```

第一次启动保留 `RUN_SEED="true"`，创建管理员后可以改成 `RUN_SEED="false"`。

## 7. 启动网站

```bash
docker compose up -d --build
docker compose logs -f app
```

确认本机服务：

```bash
curl http://127.0.0.1:3000/login
```

## 8. 配置域名和 HTTPS

推荐用 Caddy，自动申请 HTTPS 证书。

安装 Caddy：

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy
```

写入配置：

```bash
nano /etc/caddy/Caddyfile
```

内容：

```text
你的域名 {
  reverse_proxy 127.0.0.1:3000
}
```

重载：

```bash
systemctl reload caddy
```

## 9. 更新网站

```bash
cd /srv/shengshou
git pull
docker compose up -d --build
docker compose logs -f app
```

## 10. 备份

手动备份：

```bash
docker compose exec app sh /app/scripts/backup.sh
ls -lh /data/shengshou/backups
```

建议后续用 crontab 每天定时备份。
