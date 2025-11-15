const { rmSync } = require('fs');
const { resolve } = require('path');

const distPath = resolve(__dirname, '..', 'dist');

try {
  rmSync(distPath, { recursive: true, force: true });
  console.log(`Removed ${distPath}`);
} catch (error) {
  console.error('Failed to clean dist:', error);
  process.exitCode = 1;
}

