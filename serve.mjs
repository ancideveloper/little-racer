// Tiny no-cache static dev server: `node serve.mjs [port]`
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2]) || 8080;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

// Dev-only: POST /__shot?name=foo.png stores a screenshot under docs/screenshots (used by the verification scripts).
function saveShot(req, res) {
  const name = new URL(req.url, 'http://x').searchParams.get('name') || 'shot.png';
  const safe = path.basename(name).replace(/[^\w.\-]/g, '_');
  const dir = path.join(root, 'docs', 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => { fs.writeFileSync(path.join(dir, safe), Buffer.concat(chunks)); res.writeHead(200); res.end('ok'); });
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/__shot')) return saveShot(req, res);
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    res.end(data);
  });
}).listen(port, () => console.log(`Little Racer dev server: http://localhost:${port}/`));
