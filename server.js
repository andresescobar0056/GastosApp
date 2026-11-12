/**
 * Servidor estático SOLO para previsualizar el diseño (HTML/CSS/JS) sin XAMPP.
 * No ejecuta PHP, así que el login y los datos NO funcionan aquí.
 * Para usar la app completa en local, usa XAMPP (ver README.md).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const ROOT = __dirname;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Solo se sirven estas extensiones (nunca .php, .sql, configs, etc.)
const ALLOWED = new Set(Object.keys(mimeTypes));

function sendIndex(res) {
  fs.readFile(path.join(ROOT, 'index.html'), (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Error interno del servidor');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeTypes['.html'] });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end('Petición inválida');
    return;
  }

  if (urlPath === '/') return sendIndex(res);

  // Resolver y comprobar que la ruta final sigue dentro del proyecto (evita ../../)
  const filePath = path.resolve(ROOT, '.' + urlPath);
  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    res.end('Prohibido');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED.has(ext)) {
    // Rutas sin extensión → SPA; extensiones no permitidas → 404
    if (!ext) return sendIndex(res);
    res.writeHead(404);
    res.end('No encontrado');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      res.end(err.code === 'ENOENT' ? 'No encontrado' : 'Error interno del servidor');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Vista previa estática en http://localhost:${PORT} (sin PHP: usa XAMPP para la app completa)`);
});
