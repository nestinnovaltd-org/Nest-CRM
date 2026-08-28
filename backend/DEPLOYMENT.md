# WhatsApp Backend — Hostinger VPS & CloudPanel Deployment Guide

This guide describes how to deploy the WhatsApp automation & AI backend to your Hostinger VPS running Ubuntu 24.04.4 LTS, managed via CloudPanel.

---

## Environment Specifications

* **Domain**: `https://api.hijibusy.com`
* **Vercel Frontend**: `https://nest-crm-gamma.vercel.app`
* **Node.js Site Directory**: `/home/hijibusy-api/htdocs/api.hijibusy.com`
* **Site User**: `hijibusy-api`
* **Internal Port**: `3001` (external HTTPS is proxied by Nginx to `127.0.0.1:3001`)
* **Node.js Version**: `20.20.2`
* **npm Version**: `10.8.2`
* **Redis**: `7.0.15` (listening on `127.0.0.1:6379`)
* **PM2 Version**: `7.0.4`

---

## Step 1 — Prepare System Directories & Permissions (Run as Root)

Log into your VPS via SSH as **root** (or a user with `sudo` privileges) and create the required external directories for session persistence and logging. Transfer their ownership to the CloudPanel site user (`hijibusy-api`):

```bash
# Create directories outside Git
sudo mkdir -p /var/www/crm/whatsapp-sessions
sudo mkdir -p /var/www/crm/logs

# Assign ownership to the site user
sudo chown -R hijibusy-api:hijibusy-api /var/www/crm
sudo chmod -R 750 /var/www/crm
```

---

## Step 2 — Deploy Code to VPS Site Directory (Run as hijibusy-api)

Switch to the site user. Since CloudPanel creates the directory `/home/hijibusy-api/htdocs/api.hijibusy.com` but it is not yet a Git repository, you need to initialize it or clone the repository:

### Option A: Initialize Git in the existing folder (Recommended)
Use this option to keep any default configurations CloudPanel might have created in the directory (e.g. `.user.ini`):
```bash
# Switch to the site user (or SSH directly as hijibusy-api)
sudo su - hijibusy-api

# Navigate to the htdocs folder
cd /home/hijibusy-api/htdocs/api.hijibusy.com

# Initialize git and link it to your repository
git init
git remote add origin https://github.com/nestinnovaltd-org/Nest-CRM.git

# Fetch and force checkout the main branch (overwriting default files if necessary)
git fetch --all
git checkout -f main
```

### Option B: Clone directly (Alternative)
If the directory is empty, you can delete it and clone the repository directly:
```bash
# Switch to the site user
sudo su - hijibusy-api

# Go to the htdocs root
cd /home/hijibusy-api/htdocs/

# Delete the empty folder created by CloudPanel
rm -rf api.hijibusy.com

# Clone your repository directly
git clone https://github.com/nestinnovaltd-org/Nest-CRM.git api.hijibusy.com
```

---

## Step 3 — Create Production `.env` File

Navigate to the `backend` folder and copy the example file:

```bash
cd /home/hijibusy-api/htdocs/api.hijibusy.com/backend
cp .env.example .env
nano .env
```

Ensure the following variables are configured for production (**never commit the `.env` file to Git**):

```ini
NODE_ENV=production
PORT=3001

# CORS allowed frontend
ALLOWED_ORIGIN=https://nest-crm-gamma.vercel.app

# Supabase secrets (Service role is BACKEND-ONLY, do not expose to Vercel)
SUPABASE_URL=https://dchwsumkpeyhvametngc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_secret_supabase_service_role_key_here

# OpenAI configuration
OPENAI_API_KEY=your_secret_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# Local Redis connection
REDIS_URL=redis://127.0.0.1:6379

# Persistent WhatsApp session files (must match chowned path in Step 1)
WHATSAPP_SESSION_PATH=/var/www/crm/whatsapp-sessions

# Logging configs
LOG_LEVEL=info
LOG_FILE=/var/www/crm/logs/whatsapp.log

# Campaign safety throttling
SAFETY_MIN_DELAY_SECONDS=8
SAFETY_MAX_DAILY_LIMIT=500
SAFETY_MAX_HOURLY=50
```

---

## Step 4 — Install Dependencies

Install only the runtime dependencies (skip `devDependencies`):

```bash
cd /home/hijibusy-api/htdocs/api.hijibusy.com/backend
npm install --omit=dev
```

---

## Step 5 — Apply Supabase SQL Schema & Functions

1. Navigate to your **Supabase Dashboard** → **SQL Editor**.
2. Run the `whatsapp_schema.sql` file located in the root of this project.
3. This creates all `whatsapp_*` tables, indexes, and triggers.
4. It also registers the campaign RPC functions:
   * `increment_campaign_sent(campaign_id UUID)`
   * `increment_campaign_failed(campaign_id UUID)`

---

## Step 6 — Start Services with PM2

The application runs three persistent processes under PM2: the API server, the outbound message campaign worker, and the background number validation checker.

```bash
cd /home/hijibusy-api/htdocs/api.hijibusy.com/backend

# Start processes defined in the ecosystem config
pm2 start ecosystem.config.cjs

# Save PM2 state to restore on server reboot
pm2 save

# Setup PM2 daemon auto-start on boot
pm2 startup
```

> **Note**: Follow any instructions printed to the screen by `pm2 startup` (which may require running a command as root to save the systemd unit file).

---

## Step 7 — Configure CloudPanel Site & SSL

Since CloudPanel already manages the reverse proxy, you do not need to configure Nginx manually.

1. Log into your **CloudPanel** admin interface.
2. Ensure your site `api.hijibusy.com` is configured as a **Node.js** app listening internally on port **`3001`**.
3. Under the **SSL/TLS** tab, request a free **Let's Encrypt** SSL certificate.
4. Ensure the Nginx reverse proxy configuration is proxying traffic to port 3001:
   ```nginx
   proxy_pass http://127.0.0.1:3001/;
   ```

---

## Step 8 — Update Vercel Frontend Environment

In your Vercel Dashboard for the frontend project:
1. Go to **Project Settings** → **Environment Variables**.
2. Add/update the following key:
   * **Key**: `VITE_WA_BACKEND_URL`
   * **Value**: `https://api.hijibusy.com`
3. Redeploy the Vercel frontend.
4. The frontend will now call `https://api.hijibusy.com/api/whatsapp/...` securely through Nginx, which proxies locally to the Node.js API on port `3001`.

---

## Step 9 — User Role Permissions

To ensure users have the WhatsApp module visible in the CRM dashboard, grant read/write access. You can do this through the CRM's Team Management page or directly in Supabase SQL editor:

```sql
UPDATE users
SET permissions = permissions || '{"WhatsApp": {"read": true, "write": true}}'::jsonb
WHERE role IN ('Admin', 'MD', 'System Admin');
```

---

## Day-to-Day Operations & Monitoring

### Service Health Checks
Check if the API, Supabase connection, and Redis connections are healthy:
```bash
curl https://api.hijibusy.com/api/whatsapp/health
```

### Viewing Logs
To check the logs of your PM2 processes:
```bash
# Main API logs (Express + Baileys socket logs)
pm2 logs whatsapp-api --lines 50

# Outbound message worker logs
pm2 logs whatsapp-message-worker --lines 50

# Target check worker logs
pm2 logs whatsapp-check-worker --lines 50

# Combined files logs
tail -f /var/www/crm/logs/whatsapp.log
```

### Restarting Services
```bash
# Restart everything
pm2 restart all

# Restart specific process
pm2 restart whatsapp-message-worker
```

### Monitoring Queue Depth
Verify BullMQ queues inside Redis:
```bash
redis-cli llen bull:whatsapp-outbound:wait
redis-cli llen bull:whatsapp-check:wait
```

---

## Troubleshooting

### `EACCES` Permission Denied on Sessions or Logs
If PM2 logs show a write failure, ensure the site user `hijibusy-api` has complete write access:
```bash
# Run as root
sudo chown -R hijibusy-api:hijibusy-api /var/www/crm
```

### Redis Connection Failures
If you see BullMQ error logs, check if Redis is running locally:
```bash
sudo systemctl status redis-server
# To start it
sudo systemctl start redis-server
```

### Port Conflicts
If port `3001` is already in use:
```bash
# Check what is using port 3001
lsof -i :3001
```
Ensure you do not have redundant Node.js processes running outside PM2.
