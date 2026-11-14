// node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/core.js');
global.window = {};
require('../data/phrases.js');
require('../data/models.js');
const SEED = window.PHRASEMAP_SEED;
const GROUPS = ['IN', 'INTO', 'OUT', 'OUT OF', 'UP', 'DOWN', 'ON', 'OFF', 'OVER', 'AWAY', 'BACK', 'ABOUT', '(A)ROUND', 'ACROSS', 'THROUGH', 'BY', 'ALONG'];

test('300 預載片語意義，涵蓋 17 個不重複小詞', () => {
  assert.strictEqual(SEED.length, 300);
  assert.deepStrictEqual([...new Set(SEED.map(r => r.group))].sort(), [...GROUPS].sort());
  assert.strictEqual(GROUPS.length, 17);
});

test('ID 唯一且格式穩定', () => {
  const ids = SEED.map(r => r.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const r of SEED) assert.match(r.id, /^seed:[a-z0-9-]+\/[a-z0-9-]+(~\d+)?$/);
});

test('舊版 seed-<序號> 全部對應到現有 ID', () => {
  const ids = new Set(SEED.map(r => r.id));
  const legacy = window.PHRASEMAP_LEGACY_IDS;
  assert.strictEqual(Object.keys(legacy).length, 51);
  for (const [k, v] of Object.entries(legacy)) assert.ok(ids.has(v), k + ' → ' + v);
  assert.strictEqual(legacy['seed-0'], 'seed:up/give-up');
  assert.strictEqual(legacy['seed-43'], 'seed:around/look-around');
});

test('每個例句都能標出動詞（紅）與所有小詞（底線）', () => {
  for (const r of SEED) {
    const a = C.annotate(r.example, [r]);
    assert.ok(a.some(x => x.type === 'verb'), r.id + ': ' + r.example);
    assert.strictEqual(a.filter(x => x.type === 'particle').length, r.phrase.split(' ').length - 1, r.id + ': ' + r.example);
  }
});

test('每個小詞至少 4 個不同中文意思（可做四選一）', () => {
  for (const g of GROUPS) assert.ok(new Set(SEED.filter(r => r.group === g).map(r => r.zh)).size >= 4, g);
});

test('token 標註：變化形、可分離、不跨句、多字小詞', () => {
  const html = C.highlight('She gave it up last year.', 'give up');
  assert.match(html, /<span class="red"[^>]*>gave<\/span>/);
  assert.match(html, /<span class="particle"[^>]*>up<\/span>/);
  assert.strictEqual(C.annotate('I gave the book. Up we go.', [{ id: 'x', phrase: 'give up' }]).length, 0);
  const a = C.annotate('We ran out of milk.', [{ id: 'r', phrase: 'run out of' }]);
  assert.deepStrictEqual(a.map(x => x.type), ['verb', 'particle', 'particle']);
  assert.strictEqual(C.annotate('They carried the plan out.', [{ id: 'c', phrase: 'carry out' }]).length, 2);
  assert.strictEqual(C.highlight('<b>x</b>', 'give up'), '&lt;b&gt;x&lt;/b&gt;');
});

test('Leitner 間隔：答對延後、答錯歸零', () => {
  const now = 1_000_000;
  const a = C.schedule(null, true, now);
  assert.strictEqual(a.box, 1); assert.strictEqual(a.due, now + 86400000);
  const b = C.schedule(a, true, now);
  assert.strictEqual(b.box, 2); assert.strictEqual(b.due, now + 2 * 86400000);
  const c = C.schedule(b, false, now);
  assert.strictEqual(c.box, 0); assert.strictEqual(c.due, now); assert.strictEqual(c.attempts, 3);
  assert.ok(C.isDue(c, now));
});

test('AI 回覆 JSON 清理', () => {
  assert.deepStrictEqual(C.extractJson('<think>hmm {x}</think>```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => C.extractJson('no json'));
});

test('內建模型清單符合 ai-models schemaVersion 1', () => {
  const m = window.PHRASEMAP_MODELS;
  assert.strictEqual(m.schemaVersion, 1);
  for (const p of ['GEMINI', 'NVIDIA', 'DEEPSEEK']) assert.ok(m.providers[p] && m.providers[p].models.length, p);
});
