import Redis from 'ioredis'
import { logger } from './logger.js'

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,     // required by BullMQ
  enableReadyCheck:     false,
  lazyConnect:          false,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error({ times }, 'Redis: too many reconnect attempts')
      return null  // stop retrying
    }
    return Math.min(times * 200, 3000)
  }
})

redis.on('connect',   () => logger.info('Redis: connected'))
redis.on('error',     (err) => logger.error({ err }, 'Redis: error'))
redis.on('reconnecting', () => logger.warn('Redis: reconnecting'))
