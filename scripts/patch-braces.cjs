/* eslint-disable @typescript-eslint/no-require-imports -- npm postinstall runs as CommonJS. */
'use strict';
// Temporary audited mitigation for GHSA-vfj7-8cjw-p6xm; upstream 3.0.3 has no fix.
// Keep the package/version visible to npm audit. Do not falsify vulnerability metadata.
const fs = require('node:fs');
const path = require('node:path');
let root;
try { root = path.dirname(require.resolve('braces/package.json')); }
catch (error) { if (error.code === 'MODULE_NOT_FOUND') process.exit(0); throw error; }
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.version !== '3.0.3') throw new Error('Review the braces depth mitigation after changing its version.');
const guard = `'use strict';
module.exports = function assertSafeDepth(value) {
  if (typeof value === 'string') {
    let depth = 0, escaped = false;
    for (const char of value) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\\\') { escaped = true; continue; }
      if ('{(['.includes(char) && ++depth > 64) throw new SyntaxError('BRACES_MAX_DEPTH');
      if ('})]'.includes(char)) depth = Math.max(0, depth - 1);
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  const pending = [[value, 0]], seen = new WeakSet();
  let count = 0;
  while (pending.length) {
    const [node, depth] = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (depth > 64 || ++count > 65536 || seen.has(node)) throw new SyntaxError('BRACES_MAX_DEPTH');
    seen.add(node);
    if (Array.isArray(node.nodes)) for (const child of node.nodes) pending.push([child, depth + 1]);
  }
};
`;
fs.writeFileSync(path.join(root, 'lib', 'depth-guard.js'), guard);
for (const [file, signature, argument] of [
  ['parse.js', 'const parse = (input, options = {}) => {', 'input'],
  ['compile.js', 'const compile = (ast, options = {}) => {', 'ast'],
  ['expand.js', 'const expand = (ast, options = {}) => {', 'ast'],
  ['stringify.js', 'module.exports = (ast, options = {}) => {', 'ast'],
]) {
  const target = path.join(root, 'lib', file);
  let source = fs.readFileSync(target, 'utf8');
  if (source.includes('// vesnice-depth-guard')) continue;
  if (!source.includes(signature)) throw new Error('Unexpected braces source: ' + file);
  source = source.replace(signature, signature + `\n  require('./depth-guard')(${argument}); // vesnice-depth-guard`);
  fs.writeFileSync(target, source);
}
console.log('Applied bounded-depth guards to braces 3.0.3 (development tooling).');
