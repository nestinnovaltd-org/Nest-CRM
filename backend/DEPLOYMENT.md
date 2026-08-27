# WhatsApp Backend — VPS Deployment Guide

## Prerequisites on VPS
```bash
node --version   # >= 20.0.0
pm2 --version    # npm install -g pm2
redis-cli ping   # should return PONG (install: apt install redis-server)
```

---

## Step 1 — Copy backend files to VPS

```bash
# From local machine — copy backend directory
rsync -avz --exclude node_modules ./backend/ user@your-vps:/var/www/crm/backend/

# Or via git (recommended)
git pull origin main
```

---

## Step 2 — Create .env on VPS

```bash
cd /var/www/crm/backend
cp .env.example .env
nano .env
```

Fill in all values — **never commit this file**:
```
NODE_ENV=production
PORT=3001
ALLOWED_ORIGIN=https://your-crm.vercel.app
SUPABASE_URL=https://dchwsumkpeyhvametngc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your service role key from Supabase dashboard>
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
REDIS_URL=redis://127.0.0.1:6379
WHATSAPP_SESSION_PATH=/var/www/crm/whatsapp-sessions
LOG_LEVEL=info
SAFETY_MIN_DELAY_SECONDS=8
SAFETY_MAX_DAILY_LIMIT=500
SAFETY_MAX_HOURLY=50
```

---

## Step 3 — Install dependencies

```bash
cd /var/www/crm/backend
npm install --omit=dev
```

---

## Step 4 — Create required directories

```bash
mkdir -p /var/www/crm/whatsapp-sessions
mkdir -p /var/www/crm/logs
chmod 750 /var/www/crm/whatsapp-sessions
```

---

## Step 5 — Apply Supabase schema

Run the `whatsapp_schema.sql` file in the Supabase SQL Editor:
1. Go to Supabase Dashboard → SQL Editor
2. Paste the contents of `whatsapp_schema.sql`
3. Click Run

Also run this helper function (needed by campaign worker):
```sql
CREATE OR REPLACE FUNCTION increment_campaign_sent(campaign_id UUID)
RETURNS VOID LANGUAGE SQL AS $$
  UPDATE whatsapp_campaigns
  SET sent_count = COALESCE(sent_count, 0) + 1,
      updated_at = NOW()
  WHERE id = campaign_id;
$$;

CREATE OR REPLACE FUNCTION increment_campaign_failed(campaign_id UUID)
RETURNS VOID LANGUAGE SQL AS $$
  UPDATE whatsapp_campaigns
  SET failed_count = COALESCE(failed_count, 0) + 1,
      updated_at = NOW()
  WHERE id = campaign_id;
$$;
```

---

## Step 6 — Start with PM2

```bash
cd /var/www/crm/backend
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # follow the printed command to enable auto-start on boot
```

Check all 3 processes are running:
```bash
pm2 list
pm2 logs whatsapp-api --lines 50
```

---

## Step 7 — Configure Nginx reverse proxy

Add to your Nginx site config (`/etc/nginx/sites-available/crm`):

```nginx
# WhatsApp Backend API
location /api/whatsapp/ {
    proxy_pass         http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection 'upgrade';
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 300s;

    # CORS is handled by Express — do NOT add CORS headers here
}
```

Then reload Nginx:
```bash
nginx -t && systemctl reload nginx
```

---

## Step 8 — Update Vercel frontend env

In Vercel Dashboard → Project Settings → Environment Variables:

| Variable | Value |
|---|---|
| `VITE_WA_BACKEND_URL` | `https://your-vps-domain.com` |

Redeploy the frontend after adding this variable.

---

## Step 9 — Add WhatsApp permission to user roles

In Supabase SQL Editor:
```sql
-- Grant WhatsApp module access to Admin and MD roles
-- (adjust based on your existing permissions setup)
UPDATE users
SET permissions = permissions || '{"WhatsApp": {"read": true, "write": true}}'::jsonb
WHERE role IN ('Admin', 'MD', 'System Admin');
```

Or do it via your existing Roles page in the CRM.

---

## Day-to-Day Operations

### Check health
```bash
curl https://your-vps.com/api/whatsapp/health
```

### View logs
```bash
pm2 logs whatsapp-api        # API server logs
pm2 logs whatsapp-message-worker  # Campaign worker
pm2 logs whatsapp-check-worker    # WA number checker
tail -f /var/www/crm/logs/whatsapp.log
```

### Restart a service
```bash
pm2 restart whatsapp-api
pm2 restart whatsapp-message-worker
```

### Monitor Redis queue depth
```bash
redis-cli llen bull:whatsapp-outbound:wait
redis-cli llen bull:whatsapp-check:wait
```

---

## Security Checklist

- [ ] `backend/.env` is NOT in git (verified in .gitignore)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only in VPS `.env`, nowhere else
- [ ] `OPENAI_API_KEY` is only in VPS `.env`
- [ ] Nginx is configured with SSL (Let's Encrypt recommended)
- [ ] Redis is bound to `127.0.0.1` only (not exposed externally)
- [ ] Supabase RLS is enabled on all `whatsapp_*` tables
- [ ] WhatsApp session files are in `/var/www/crm/whatsapp-sessions` (not in git)
- [ ] PM2 auto-start is configured (`pm2 startup && pm2 save`)

---

## WhatsApp Usage Best Practices

> **These rules are enforced by the backend — but follow them manually too.**

1. **Never send more than 200–300 messages per day per number** (stay well under the 500 limit)
2. **Minimum 8–15 seconds between messages** (random delay is automatically applied)
3. **Only message people who consented** — use the consent checkbox on every campaign
4. **Monitor disconnections** — the app sends in-app notifications when a session drops
5. **Rotate sessions** — if a number gets banned, create a new session with a different number
6. **Check opt-outs** — always respect when leads reply "Stop" or similar keywords
