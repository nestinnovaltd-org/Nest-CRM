import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Redact secrets from all log output
  redact: {
    paths: [
      'OPENAI_API_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'req.headers.authorization',
      'body.password',
      'body.token'
    ],
    censor: '[REDACTED]'
  },
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : {
        targets: [
          {
            target: 'pino/file',
            options: { destination: process.env.LOG_FILE || '/var/www/crm/logs/whatsapp.log' }
          }
        ]
      }
})
