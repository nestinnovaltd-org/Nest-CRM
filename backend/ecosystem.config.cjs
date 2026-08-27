// PM2 ecosystem config for the WhatsApp backend on VPS
// Usage: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name:        'whatsapp-api',
      script:      './src/index.js',
      cwd:         '/var/www/crm/backend',
      instances:   1,
      exec_mode:   'fork',
      node_args:   '--experimental-vm-modules',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT:     3001
      },
      // Restart policy
      max_restarts:    10,
      restart_delay:   5000,
      min_uptime:      '10s',
      // Logging
      log_file:        '/var/www/crm/logs/whatsapp-combined.log',
      out_file:        '/var/www/crm/logs/whatsapp-out.log',
      error_file:      '/var/www/crm/logs/whatsapp-err.log',
      merge_logs:      true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name:    'whatsapp-message-worker',
      script:  './src/workers/messageWorker.js',
      cwd:     '/var/www/crm/backend',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_restarts:    10,
      restart_delay:   5000,
      out_file:   '/var/www/crm/logs/msg-worker-out.log',
      error_file: '/var/www/crm/logs/msg-worker-err.log',
      merge_logs: true
    },
    {
      name:    'whatsapp-check-worker',
      script:  './src/workers/checkWorker.js',
      cwd:     '/var/www/crm/backend',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_restarts:    10,
      restart_delay:   5000,
      out_file:   '/var/www/crm/logs/check-worker-out.log',
      error_file: '/var/www/crm/logs/check-worker-err.log',
      merge_logs: true
    }
  ]
}
