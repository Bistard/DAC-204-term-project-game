const { rmSync } = require('fs');
const { resolve } = require('path');

const outDir = resolve(__dirname, '..', 'dist-tests');

try {
  rmSync(outDir, { recursive: true, force: true });
  console.log(`Removed ${outDir}`);
} catch (error) {
  console.error('Failed to clean dist-tests:', error);
  process.exitCode = 1;
}
