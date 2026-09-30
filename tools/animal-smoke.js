// Smoke test for an animal module: draws every mode over a few seconds with a recording stub canvas
// and fails on exceptions, NaN coordinates or a missing registration.
// Usage: node tools/animal-smoke.js js/animals/turtle.js turtle
const fs = require('fs'), vm = require('vm'), path = require('path');
const [file, key] = process.argv.slice(2);
if (!file || !key) { console.error('usage: node tools/animal-smoke.js <file> <key>'); process.exit(2); }
let calls = 0, bad = [];
const grad = { addColorStop() {} };
const ctx = new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'measureText') return s => ({ width: String(s).length * 6 });
    if (k === 'createPattern' || k.startsWith('create')) return () => grad;
    return (...args) => { calls++; for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) bad.push(`${String(k)}(${args.join(', ')})`); };
  },
  set(t, k, v) { t[k] = v; return true; },
});
const mkCanvas = () => ({ width: 0, height: 0, getContext: () => ctx });
const sandbox = { console, Math, document: { createElement: mkCanvas } };
sandbox.window = sandbox;
vm.createContext(sandbox);
const root = path.resolve(__dirname, '..');
vm.runInContext(fs.readFileSync(path.join(root, 'js/animals/kit.js'), 'utf8'), sandbox, { filename: 'kit.js' });
vm.runInContext(fs.readFileSync(path.resolve(file), 'utf8'), sandbox, { filename: file });
const def = sandbox.ANIMALS[key];
if (!def) { console.error(`FAIL: ANIMALS.${key} was not registered`); process.exit(1); }
for (const f of ['key', 'name', 'status', 'draw']) if (!def[f]) { console.error(`FAIL: missing ${f}`); process.exit(1); }
const modes = ['run', 'idle', 'ride', 'cheer', 'worry'], emotions = ['focus', 'worry', 'cheer', 'sad'];
for (const mode of modes) for (let t = 0; t < 4; t += .05) {
  const o = { t, mode, speed: .3 + (t % 1.3), emotion: emotions[Math.floor(t * 3) % 4], look: Math.sin(t), bib: { n: '3', bg: '#e2372c', fg: '#fff' }, scale: 1 };
  try { def.draw(ctx, o); def.draw(ctx, { ...o, bib: null, scale: .4 }); }
  catch (e) { console.error(`FAIL: ${mode} at t=${t.toFixed(2)}: ${e.stack}`); process.exit(1); }
}
if (bad.length) { console.error(`FAIL: non-finite numbers, e.g. ${bad.slice(0, 3).join(' | ')}`); process.exit(1); }
console.log(`OK ${key} "${def.name}" (${def.status}): ${calls} draw calls across ${modes.length} modes`);
