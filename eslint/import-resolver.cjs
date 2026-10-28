const fs = require('node:fs');
const path = require('node:path');

const webSrc = path.resolve(__dirname, '../apps/web/src');
const extensions = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs', '.json'];

function isFile(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function resolveFile(base) {
  for (const ext of extensions) {
    const candidate = `${base}${ext}`;
    if (isFile(candidate)) return candidate;
  }
  if (isFile(base)) return base;
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of extensions) {
      const candidate = path.join(base, `index${ext}`);
      if (isFile(candidate)) return candidate;
    }
  }
  return null;
}

/** Resolves the web `@/` alias. Other imports stay with the next resolver. */
module.exports = {
  interfaceVersion: 2,
  resolve(source, file) {
    const base = source.startsWith('@/')
      ? path.join(webSrc, source.slice(2))
      : source.startsWith('.')
        ? path.resolve(path.dirname(file), source)
        : null;
    if (!base) return { found: false };
    const resolved = resolveFile(base);
    return resolved ? { found: true, path: resolved } : { found: false };
  },
};
