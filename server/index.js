import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.static(join(__dirname, '..', 'public')));

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nAllow: /\nSitemap: https://dailyaigen.com/sitemap.xml\n');
});

app.get('/sitemap.xml', (_req, res) => {
  let apps = [];
  try { apps = JSON.parse(readFileSync(join(__dirname, '..', 'apps.json'), 'utf8')); } catch {}
  const appUrls = apps.map(a =>
    `  <url><loc>https://dailyaigen.com/apps/${a.id || a.date}/</loc><lastmod>${a.date}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`
  ).join('\n');
  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://dailyaigen.com/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
${appUrls}
</urlset>`);
});

app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Johnlund running on port ${PORT}`));
