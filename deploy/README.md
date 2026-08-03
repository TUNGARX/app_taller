# Deploy Runbook (DigitalOcean Droplet + Volume)

**Live**: https://taller.automotivo.fonsfideishop.com (Droplet IP: 142.93.63.66)

Ubuntu 24.04 LTS Droplet (NYC1), 1GB RAM + 2GB swap, 10GB Volume mounted at
`/mnt/volume_nyc1_.../taller-data` and **bind-mounted** onto the app's
`data/` directory so `data/taller.db` (business data + user accounts)
persists across deploys and reboots.

**Use a bind mount, not a symlink, for `data/`.** A symlink was tried first
and broke the build the moment `data/taller.db` actually existed: Turbopack's
file tracer follows the symlink during `npm run build` and hard-fails with
`Symlink [project]/data/taller.db is invalid, it points out of the
filesystem root` — it worked on the very first build (before the DB file
existed) and then broke permanently on every rebuild after. A bind mount
looks like a normal directory to Turpoback (no symlink indirection), so
it doesn't hit this at all.

DNS for `taller.automotivo.fonsfideishop.com` is managed at Namecheap (a single A record
for the `app` subdomain), **not** delegated to DigitalOcean — the root
domain has an active MX record for Google email, so nameservers were
deliberately left alone to avoid touching that. Switching to a different
domain/subdomain later is simple: point a new A record at the Droplet's IP,
update `server_name` in `deploy/nginx-taller.conf`, run `certbot --nginx -d
<new-domain>` again — no rebuild or data migration needed.

## One-time server setup

```bash
apt-get update -y
apt-get install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx git build-essential python3
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs

# 2GB swap (1GB RAM is tight for `next build`)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Dedicated non-root user, app lives at /opt/taller-app/app
useradd --system --create-home --home-dir /opt/taller-app --shell /usr/sbin/nologin taller
chmod 755 /opt/taller-app

# data/ lives on the attached Volume, not the ephemeral root disk --
# bind mount, NOT a symlink (see the note above on why).
mkdir -p /mnt/<volume>/taller-data
chown -R taller:taller /mnt/<volume>/taller-data

su - taller -s /bin/bash -c 'git clone https://github.com/TUNGARX/app_taller.git /opt/taller-app/app'
mkdir /opt/taller-app/app/data
chown taller:taller /opt/taller-app/app/data
echo '/mnt/<volume>/taller-data /opt/taller-app/app/data none bind 0 0' >> /etc/fstab
mount /opt/taller-app/app/data

# See .env.production.example — copy to /opt/taller-app/app/.env.local with a
# freshly generated AUTH_SECRET, chmod 600. Also set GOOGLE_SERVICE_ACCOUNT_JSON
# and GOOGLE_IMPERSONATE_EMAIL once the Google Drive/Calendar integration
# (feature/google-drive-calendar branch) is merged — see that file's comments
# for how to generate the service-account key.

su - taller -s /bin/bash -c 'cd /opt/taller-app/app && npm ci && npm run build'

cp deploy/taller.service /etc/systemd/system/taller.service
systemctl daemon-reload && systemctl enable --now taller

cp deploy/nginx-taller.conf /etc/nginx/sites-available/taller
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/taller /etc/nginx/sites-enabled/taller
nginx -t && systemctl reload nginx

# Once DNS points a domain at the Droplet's IP (add the A record at your
# registrar/DNS host first, confirm with `nslookup <domain>` before running):
certbot --nginx -d your-domain.example
# certbot rewrites deploy/nginx-taller.conf in place to add the SSL server
# block + HTTP->HTTPS redirect -- copy the live file back into this repo
# afterward so it stays in sync (see nginx-taller.conf's own header comment).

# First Owner account:
su - taller -s /bin/bash -c 'cd /opt/taller-app/app && npx tsx scripts/seed-owner.ts <usuario> <password> <nombre>'
```

## Routine deploys

```bash
su - taller -s /bin/bash -c 'cd /opt/taller-app/app && git pull && npm ci && npm run build'
systemctl restart taller
```

## Restoring from a backup ZIP (disaster recovery)

```bash
su - taller -s /bin/bash -c 'cd /opt/taller-app/app && npx tsx scripts/restaurar-respaldo.ts <ruta-al-zip> --confirmar'
```
