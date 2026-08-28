import pino from 'pino'
import fs from 'fs'
import path from 'path'

const isDev = process.env.NODE_ENV !== 'production'

let logDestination = process.env.LOG_FILE || '/var/www/crm/logs/whatsapp.log'

if (!isDev) {
  const logDir = path.dirname(logDestination)
  try {
    fs.mkdirSync(logDir, { recursive: true })
  } catch (err) {
    console.error(`[logger] Warning: Failed to create log directory at ${logDir}: ${err.message}. Falling back to console logging.`)
    logDestination = 'console'
  }
}

const pinoConfig = {
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'OPENAI_API_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'req.headers.authorization',
      'body.password',
      'body.token',
      'headers.authorization',
      'credentials',
      'creds',
      '*.creds',
      '*.noiseKey',
      '*.signedIdentityKey',
      '*.signedPreKey',
      '*.registrationId',
      '*.advSecretKey',
      '*.nextPreKeyId',
      '*.firstUnuploadedPreKeyId',
      '*.account',
      '*.me',
      '*.signalIdentities'
    ],
    censor: '[REDACTED]'
  }
}

let transport
if (isDev) {
  transport = { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
} else if (logDestination !== 'console') {
  transport = {
    target: 'pino/file',
    options: { destination: logDestination }
  }
}

export const logger = transport ? pino(pinoConfig, pino.transport(transport)) : pino(pinoConfig)
