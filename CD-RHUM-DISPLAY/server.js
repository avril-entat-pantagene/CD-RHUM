// Express server for production: serves /dist and /api/helloasso-scrape
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const HELLOASSO_HOSTNAME = 'www.helloasso.com';
const SCRAPE_PATH = '/api/helloasso-scrape';

function fetchWithCurl(source) {
  return new Promise((resolve) => {
    execFile('curl', [
      '-L',
      '-s',
      '--compressed',
      '-w', '\n%{http_code}',
      source,
      '-H', 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      '-H', 'Accept-Language: fr-FR,fr;q=0.9,en;q=0.8',
      '-H', 'Cache-Control: no-cache',
      '-H', 'Pragma: no-cache',
    ], { maxBuffer: 10 * 1024 * 1024, timeout: 30000 }, (err, stdout) => {
      if (err) {
        console.error('curl error:', err.message);
        resolve({ status: 500, body: 'curl failed' });
        return;
      }
      const statusMatch = stdout.match(/\n(\d{3})\s*$/);
      const status = statusMatch ? Number.parseInt(statusMatch[1], 10) : 500;
      const body = statusMatch ? stdout.slice(0, statusMatch.index) : stdout;
      resolve({ status, body });
    });
  });
}

app.get(SCRAPE_PATH, async (req, res) => {
  try {
    const source = req.query.source;
    if (!source) {
      res.status(400).type('text/plain').send('Missing query param: source');
      return;
    }
    const parsedSource = new URL(source);
    if (parsedSource.hostname !== HELLOASSO_HOSTNAME) {
      res.status(400).type('text/plain').send('Only helloasso source is allowed');
      return;
    }
    const upstreamResponse = await fetchWithCurl(parsedSource.toString());
    res.status(upstreamResponse.status).type('text/html').send(upstreamResponse.body);
  } catch (err) {
    console.error('scrape error:', err);
    res.status(500).type('text/plain').send('Failed to scrape source');
  }
});

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));
// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
