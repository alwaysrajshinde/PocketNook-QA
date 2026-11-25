#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'client/dist');
const indexPath = path.join(distDir, 'index.html');
const fallbackHtmlPath = path.join(distDir, '404.html');
const manifestPath = path.join(distDir, 'manifest.json');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html
    .replace('<title>PocketNook</title>', '<title>PocketNook QA</title>')
    .replace('content="PocketNook"', 'content="PocketNook QA"')
    .replace('content="PocketNook"', 'content="PocketNook QA"')
    .replace('content="#6C47FF"', 'content="#D97706"')
    .replace('href="./icon.svg"', 'href="./icon-qa.svg"')
    .replace(/href="\.\/icon-(192|512)\.png"/g, 'href="./icon-qa.svg"');
  fs.writeFileSync(indexPath, html, 'utf8');
}

if (fs.existsSync(fallbackHtmlPath)) {
  const html404 = fs.readFileSync(fallbackHtmlPath, 'utf8').replace('<title>PocketNook</title>', '<title>PocketNook QA</title>');
  fs.writeFileSync(fallbackHtmlPath, html404, 'utf8');
}

if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.name = 'PocketNook QA';
  manifest.short_name = 'PocketNook QA';
  manifest.description = 'PocketNook QA Staging Build — For testing and verification only.';
  manifest.theme_color = '#D97706';
  manifest.icons = [
    {
      src: './icon-qa.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any maskable'
    }
  ];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

console.log('[qa-branding] Applied PocketNook QA title, amber theme, manifest, and QA icon to client/dist');
