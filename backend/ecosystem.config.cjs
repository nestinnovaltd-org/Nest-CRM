// PM2 ecosystem config for the WhatsApp backend on VPS
// Usage: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name:        'whatsapp-api',
      script:      './src/index.js',
      cwd:         '/home/hijibusy-api/htdocs/api.hijibusy.com/backend',
      instances:   1,
      exec_mode:   'fork',
      node_args:   '--experimental-vm-modules --experimental-websocket',
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
      log_file:        '/home/hijibusy-api/htdocs/api.hijibusy.com/logs/whatsapp-combined.log',
      out_file:        '/home/hijibusy-api/htdocs/api.hijibusy.com/logs/whatsapp-out.log',
      error_file:      '/home/hijibusy-api/htdocs/api.hijibusy.com/logs/whatsapp-err.log',
      merge_logs:      true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name:    'whatsapp-message-worker',
      script:  './src/workers/messageWorker.js',
      cwd:     '/home/hijibusy-api/htdocs/api.hijibusy.com/backend',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--experimental-websocket',
      env: { NODE_ENV: 'production' },
      max_restarts:    10,
      restart_delay:   5000,
      out_file:   '/home/hijibusy-api/htdocs/api.hijibusy.com/logs/msg-worker-out.log',
      error_file: '/home/hijibusy-api/htdocs/api.hijibusy.com/logs/msg-worker-err.log',
      merge_logs: true
    },
    {
      name:    'whatsapp-check-worker',
      script:  './src/workers/checkWorker.js',
      cwd:     '/home/hijibusy-api/htdocs/api.hijibusy.com/backend',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--experimental-websocket',
      env: { NODE_ENV: 'production' },
      max_restarts:    10,
      restart_delay:   5000,
      out_file:   '/home/hijibusy-api/htdocs/api.hijibusy.com/logs/check-worker-out.log',
      error_file: '/home/hijibusy-api/htdocs/api.hijibusy.com/logs/check-worker-err.log',
      merge_logs: true
    }
  ]
}
