import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { requireAuth } from './middleware/auth.js'
import { apiRateLimit } from './middleware/rateLimit.js'
import { logger } from './utils/logger.js'
import { redis } from './utils/redis.js'
import { supabase } from './utils/supabase.js'
import { sessionManager } from './services/whatsapp/sessionManager.js'

// Route imports
import sessionsRouter      from './routes/whatsapp/sessions.js'
import leadsRouter         from './routes/whatsapp/leads.js'
import templatesRouter     from './routes/whatsapp/templates.js'
import campaignsRouter     from './routes/whatsapp/campaigns.js'
import messagesRouter      from './routes/whatsapp/messages.js'
import conversationsRouter from './routes/whatsapp/conversations.js'
import aiRouter            from './routes/whatsapp/ai.js'

const app  = express()
const PORT = process.env.PORT || 3001

// Trust reverse proxy (CloudPanel / Nginx) for rate limiter and IP forwarding
app.set('trust proxy', 1)

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean)

const isOriginAllowed = (origin) => {
  if (!origin) return true
  if (allowedOrigins.length === 0 || allowedOrigins.includes('*')) return true
  if (allowedOrigins.includes(origin)) return true
  
  // Allow any vercel deployment app or matching origin
  if (origin.endsWith('.vercel.app')) return true
  
  return allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = new RegExp('^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$')
      return pattern.test(origin)
    }
    return allowed === origin
  })
}

app.use(cors({
  origin: (origin, cb) => {
    if (isOriginAllowed(origin)) {
      return cb(null, true)
    }
    logger.warn({ origin }, 'CORS: rejected origin')
    cb(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.options('*', cors())

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// ─── Request logging ──────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info({ method: req.method, path: req.path, ip: req.ip }, 'Incoming request')
  next()
})

// ─── Health check (no auth required — used by monitoring & Nginx) ─────────────
app.get('/api/whatsapp/health', async (_req, res) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    services: { supabase: 'unknown', redis: 'unknown', sessions: {} }
  }

  try {
    await supabase.from('whatsapp_sessions').select('id').limit(1)
    checks.services.supabase = 'connected'
  } catch (err) {
    checks.services.supabase = 'error'
    checks.status = 'degraded'
    logger.error({ err }, 'Health check: Supabase error')
  }

  try {
    await redis.ping()
    checks.services.redis = 'connected'
  } catch (err) {
    checks.services.redis = 'error'
    checks.status = 'degraded'
    logger.error({ err }, 'Health check: Redis error')
  }

  checks.services.sessions = {
    active: sessionManager.getConnectedCount(),
    total:  sessionManager.getTotalCount()
  }

  res.status(checks.status === 'ok' ? 200 : 503).json(checks)
})

// ─── Protected routes ─────────────────────────────────────────────────────────
app.use('/api/whatsapp', apiRateLimit, requireAuth)

app.use('/api/whatsapp/sessions',      sessionsRouter)
app.use('/api/whatsapp/leads',         leadsRouter)
app.use('/api/whatsapp/templates',     templatesRouter)
app.use('/api/whatsapp/campaigns',     campaignsRouter)
app.use('/api/whatsapp/messages',      messagesRouter)
app.use('/api/whatsapp/conversations', conversationsRouter)
app.use('/api/whatsapp/ai',            aiRouter)

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error({ err }, 'Unhandled error')
  res.status(500).json({ error: 'Internal server error' })
})

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'WhatsApp backend started')
})

export default app
// Trigger reload

