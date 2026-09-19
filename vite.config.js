import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import handler from './api/extract.js'

// Dev-only middleware: lets `npm run dev` serve /api/extract directly,
// so you don't need the Vercel CLI (which has a known crash on some
// Windows setups) just to test the AI integration locally. Vercel itself
// still runs api/extract.js as a real serverless function in production.
function apiMiddleware(env) {
  return {
    name: 'local-api-extract',
    configureServer(server) {
      server.middlewares.use('/api/extract', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method not allowed') }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', async () => {
          req.body = body ? JSON.parse(body) : {}
          process.env.OPENROUTER_API_KEY = env.OPENROUTER_API_KEY
          const json = (code, data) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(data)) }
          await handler(req, { status: (c) => ({ json: (d) => json(c, d) }) })
        })
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), apiMiddleware(env)],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/setupTests.js',
      coverage: { reporter: ['text', 'html'], include: ['src/**'] }
    }
  }
})