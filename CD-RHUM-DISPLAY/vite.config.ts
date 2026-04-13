import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const HELLOASSO_HOSTNAME = 'www.helloasso.com'
const SCRAPE_PATH = '/api/helloasso-scrape'
const execFileAsync = promisify(execFile)

type UpstreamResponse = {
  status: number
  body: string
}

async function fetchWithNode(source: string): Promise<UpstreamResponse> {
  const upstreamResponse = await fetch(source, {
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8',
      pragma: 'no-cache',
      'cache-control': 'no-cache',
    },
  })

  const body = await upstreamResponse.text()
  return {
    status: upstreamResponse.status,
    body,
  }
}

async function fetchWithCurl(source: string): Promise<UpstreamResponse> {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '-s',
    '--compressed',
    '-w',
    '\n%{http_code}',
    source,
    '-H',
    'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    '-H',
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '-H',
    'Accept-Language: fr-FR,fr;q=0.9,en;q=0.8',
    '-H',
    'Cache-Control: no-cache',
    '-H',
    'Pragma: no-cache',
  ], { maxBuffer: 10 * 1024 * 1024 })

  const statusMatch = stdout.match(/\n(\d{3})\s*$/)
  const status = statusMatch ? Number.parseInt(statusMatch[1], 10) : 500
  const body = statusMatch ? stdout.slice(0, statusMatch.index) : stdout

  return {
    status,
    body,
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    {
      name: 'helloasso-scrape-proxy',
      configureServer(server) {
        server.middlewares.use(SCRAPE_PATH, async (req, res) => {
          try {
            const requestUrl = new URL(req.url ?? SCRAPE_PATH, 'http://localhost')
            const source = requestUrl.searchParams.get('source')

            if (!source) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'text/plain; charset=utf-8')
              res.end('Missing query param: source')
              return
            }

            const parsedSource = new URL(source)
            if (parsedSource.hostname !== HELLOASSO_HOSTNAME) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'text/plain; charset=utf-8')
              res.end('Only helloasso source is allowed')
              return
            }

            const nodeResponse = await fetchWithNode(parsedSource.toString())
            const upstreamResponse = nodeResponse.status === 403
              ? await fetchWithCurl(parsedSource.toString())
              : nodeResponse

            res.statusCode = upstreamResponse.status
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(upstreamResponse.body)
          } catch {
            res.statusCode = 500
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('Failed to scrape source')
          }
        })
      },
    },
  ],
})
