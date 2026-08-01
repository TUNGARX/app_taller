# Deploy Runbook (DigitalOcean Droplet + Volume)

Live setup: Ubuntu 24.04 LTS Droplet (NYC1), 1GB RAM + 2GB swap, 10GB Volume
mounted at `/mnt/volume_nyc1_.../taller-data` and symlinked to the app's
`data/` directory so `data/taller.db` (business data + user accounts)
persists across deploys and reboots.

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

# data/ lives on the attached Volume, not the ephemeral root disk
mkdir -p /mnt/<volume>/taller-data
chown -R taller:taller /mnt/<volume>/taller-data

su - taller -s /bin/bash -c 'git clone https://github.com/TUNGARX/app_taller.git /opt/taller-app/app'
su - taller -s /bin/bash -c 'ln -s /mnt/<volume>/taller-data /opt/taller-app/app/data'

# See .env.production.example — copy to /opt/taller-app/app/.env.local with a
# freshly generated AUTH_SECRET, chmod 600.

su - taller -s /bin/bash -c 'cd /opt/taller-app/app && npm ci && npm run build'

cp deploy/taller.service /etc/systemd/system/taller.service
systemctl daemon-reload && systemctl enable --now taller

cp deploy/nginx-taller.conf /etc/nginx/sites-available/taller
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/taller /etc/nginx/sites-enabled/taller
nginx -t && systemctl reload nginx

# Once DNS points a domain at the Droplet's IP:
certbot --nginx -d your-domain.example

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
