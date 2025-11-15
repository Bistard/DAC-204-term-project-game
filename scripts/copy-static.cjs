const { cpSync, existsSync, mkdirSync } = require('fs');
const { resolve } = require('path');

const publicDir = resolve(__dirname, '..', 'public');
const distDir = resolve(__dirname, '..', 'dist');

if (!existsSync(publicDir)) {
  console.warn('Nothing to copy because the public directory is missing.');
  process.exit(0);
}

mkdirSync(distDir, { recursive: true });

try {
  cpSync(publicDir, distDir, { recursive: true });
  console.log(`Copied static assets from ${publicDir} to ${distDir}`);
} catch (error) {
  console.error('Failed to copy static assets:', error);
  process.exitCode = 1;
}

