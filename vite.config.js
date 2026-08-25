import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { promises as fs } from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

// A mock server plugin to run Vercel serverless functions in Vite dev mode
function localApiPlugin() {
  return {
    name: 'local-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          const apiPath = url.pathname; // e.g. /api/forgot-password
          
          // Map to absolute file path in local directory
          const filePath = path.join(process.cwd(), apiPath + '.js');

          try {
            // Check if API handler file exists
            await fs.access(filePath);
            
            // Format Windows paths correctly for ESM dynamic imports
            const fileUrl = pathToFileURL(filePath).href;
            
            // Import the Vercel serverless handler dynamically
            const module = await import(`${fileUrl}?update=${Date.now()}`);
            const handler = module.default;

            // Simple body parser for POST requests
            let body = {};
            if (req.method === 'POST') {
              body = await new Promise((resolve) => {
                let data = '';
                req.on('data', chunk => { data += chunk; });
                req.on('end', () => {
                  try {
                    resolve(JSON.parse(data));
                  } catch {
                    resolve({});
                  }
                });
              });
            }

            // Mock Vercel req and res properties
            req.body = body;
            req.query = Object.fromEntries(url.searchParams);
            
            res.status = (statusCode) => {
              res.statusCode = statusCode;
              return res;
            };
            res.json = (jsonData) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(jsonData));
            };

            await handler(req, res);
          } catch (err) {
            console.error('API Error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
          }
        } else {
          next();
        }
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables (including non-VITE_ ones) and set them on process.env
  const env = loadEnv(mode, process.cwd(), '');
  for (const key in env) {
    process.env[key] = env[key];
  }

  return {
    plugins: [react(), localApiPlugin()],
  };
});
