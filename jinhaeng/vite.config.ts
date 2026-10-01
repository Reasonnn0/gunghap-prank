import { cpSync, createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'

function contentPlugin(): Plugin {
  const root = path.resolve('content')
  const serve = (req: { url?: string }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    const raw = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '')
    const file = path.resolve(root, raw)
    const base = path.resolve(root)
    if (file !== base && !file.startsWith(`${base}${path.sep}`)) return next()
    if (!existsSync(file) || !statSync(file).isFile()) return next()
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    createReadStream(file).pipe(res as unknown as NodeJS.WritableStream)
  }
  return {
    name: 'content-dir',
    configureServer(server) {
      server.middlewares.use('/content', serve)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/content', serve)
    },
    closeBundle() {
      cpSync(root, path.resolve('dist/content'), { recursive: true })
    },
  }
}

export default defineConfig({
  plugins: [contentPlugin()],
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
})
