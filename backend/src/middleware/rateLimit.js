import rateLimit from 'express-rate-limit'
import { logger } from '../utils/logger.js'

export const apiRateLimit = rateLimit({
  windowMs:         60 * 1000,   // 1 minute window
  max:              120,          // 120 requests per minute per IP
  standardHeaders:  true,
  legacyHeaders:    false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Rate limit exceeded')
    res.status(429).json({ error: 'Too many requests. Please slow down.' })
  }
})
