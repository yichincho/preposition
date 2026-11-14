// 本機端到端測試：node tests/e2e.js（需要 Playwright + Chromium）
// 1) 網頁版：17 小詞、無 AI、複習、舊版資料遷移、備份還原、手機寬度
// 2) 模擬 Android 原生橋接：AI 設定、AI 解說、系列文章生成與標註、備份走原生儲存
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const V1 = process.env.V1_HTML; // 舊版 index.html（測試遷移用，可省略）
let serveV1 = false;
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/' || p === '/index.html') { r.setHeader('content-type', 'text/html;charset=utf-8'); return r.end(serveV1 ? fs.readFileSync(V1) : fs.readFileSync(path.join(ROOT, 'index.html'))); }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', f.endsWith('.js') ? 'application/javascript' : 'application/octet-stream');
  r.end(fs.readFileSync(f));
}).listen(0);
const URL = () => 'http://localhost:' + srv.address().port + '/';
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('  ✓ ' + m); };

const NATIVE_MOCK = () => {
  const keys = {};
  window.__calls = [];
  const reply = (id, o) => setTimeout(() => window.__phNative.resolve(id, JSON.stringify(o)), 20);
  window.PhraseMapNative = {
    hasKey: p => !!keys[p], clearKey: p => { delete keys[p]; }, copyText: t => { window.__copied = t; },
    promptKey: (id, p) => { keys[p] = 'k'; reply(id, { ok: true }); },
    saveFile: (id, name, mime, text) => { window.__saved = { name, text }; reply(id, { ok: true }); },
    aiRequest: (id, provider, p, body) => {
      window.__calls.push({ provider, p, body });
      const b = JSON.parse(body);
      const user = b.contents ? b.contents[0].parts[0].text : b.messages[1].content;
      let out;
      if (user.includes('Return {"ok":true}')) out = { ok: true };
      else if (user.includes('規劃')) {
        const ids = [...user.matchAll(/id=(\S+)｜/g)].map(m => m[1]);
        out = { series_title: '測試系列', articles: [{ title: 'Part One', summary: '第一篇', phrase_ids: ids.slice(0, 3) }, { title: 'Part Two', summary: '第二篇', phrase_ids: ids.slice(3, 5) }] };
      } else if (user.includes('本篇必須使用')) {
        const ph = [...user.matchAll(/｜([a-z ]+)｜意思/g)].map(m => m[1]);
        // 第一個片語用過去式＋可分離寫法，最後一個故意不使用（應被標成待審核）
        const sentences = ph.slice(0, -1).map((x, i) => { const w = x.split(' '); return i === 0 ? 'Yesterday we ' + (w[0] === 'give' ? 'gave' : w[0]) + ' it ' + w.slice(1).join(' ') + ' quickly.' : 'Then they ' + x + ' together.'; });
        out = { title: 'Generated', paragraphs: [sentences.join(' '), 'The end.'], glossary_zh: '測試摘要' };
      } else out = { core_image: '向上', explanation: '說明', examples: [{ en: 'She gave up smoking.', zh: '她戒菸了。' }], usage_note: '可分離' };
      const text = '<think>x</think>' + JSON.stringify(out);
      const resp = provider === 'GEMINI' ? { candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text }] } }] } : { choices: [{ message: { content: text } }] };
      reply(id, { ok: true, status: 200, body: JSON.stringify(resp) });
    },
  };
};

(async () => {
  const b = await chromium.launch();
  const errs = [];
  // ── 舊版資料遷移 ──
  if (V1 && fs.existsSync(V1)) {
    console.log('舊版（v1）資料遷移');
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    serveV1 = true;
    await p.goto(URL());
    await p.waitForSelector('[data-group]');
    await p.evaluate(async () => { await put('notes', { id: 'seed-7', text: 'v1 note' }); await put('progress', { id: 'seed-43', attempts: 2, correct: 1 }); await put('media', { id: 'm1', phraseId: 'seed-0', name: 'a.png', blob: new Blob(['x'], { type: 'image/png' }) }); });
    serveV1 = false;
    await p.reload();
    await p.waitForSelector('[data-group]');
    const r = await p.evaluate(async () => ({ note: (await get('notes', 'seed:out/find-out'))?.text, prog: (await get('progress', 'seed:around/look-around'))?.attempts, media: (await all('media'))[0].phraseId, old: await get('notes', 'seed-7') }));
    assert(r.note === 'v1 note' && r.prog === 2 && r.media === 'seed:up/give-up' && !r.old, '筆記、複習紀錄、圖片從 seed-<序號> 遷移到穩定 ID');
    await ctx.close();
  }

  // ── 網頁版 ──
  console.log('網頁版');
  const ctx = await b.newContext({ acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(URL());
  await p.waitForSelector('[data-group]');
  const tiles = await p.$$eval('[data-group]', x => x.map(t => t.dataset.group));
  assert(tiles.length === 17 && new Set(tiles).size === 17 && tiles.includes('OUT OF') && !tiles.some(t => t.includes('/')), '17 個不重複小詞入口（含 OUT OF，無比較課入口）');
  const navs = await p.$$eval('[data-tab]', x => x.map(t => t.dataset.tab));
  assert(!navs.includes('ai') && !navs.includes('articles'), '網頁版不顯示 AI 功能');
  await p.click('[data-group="ABOUT"]');
  assert(await p.isVisible('text=比較課：ABOUT 與 (A)ROUND'), 'ABOUT 頁面顯示比較課說明');
  await p.click('text=片語庫');
  assert((await p.textContent('#view')).includes('共 300 個片語意義'), '片語庫 300 筆');
  await p.fill('#search', 'run out');
  assert((await p.$$('[data-open]')).length >= 1, '搜尋可用');
  // 每組四選一
  await p.click('text=牌卡複習');
  for (const g of tiles) {
    await p.selectOption('#qgroup', g);
    await p.click('#start');
    assert(await p.$$eval('[data-choice]', x => x.length) === 4, g + ' 可做四選一');
    await p.evaluate(() => { state.quiz = null; quizView(); });
  }
  // 答錯再練 + Leitner
  await p.selectOption('#qgroup', 'UP'); await p.selectOption('#qcount', '10'); await p.click('#start');
  const total0 = await p.evaluate(() => state.quiz.items.length);
  const target = await p.evaluate(() => state.quiz.items[0].id);
  await p.click('[data-choice]:not([data-choice="' + target + '"])');
  await p.waitForTimeout(150);
  assert(await p.evaluate(() => state.quiz.items.length) === total0 + 1, '答錯的卡加到本回合最後再練');
  const prog = await p.evaluate(id => get('progress', id), target);
  assert(prog.box === 0 && prog.wrong === 1, '答錯 → Leitner box 0');
  await p.click('#next');
  const t2 = await p.evaluate(() => state.quiz.items[1].id);
  await p.click('[data-choice="' + t2 + '"]'); await p.waitForTimeout(150);
  const prog2 = await p.evaluate(id => get('progress', id), t2);
  assert(prog2.box === 1 && prog2.due > Date.now() + 80000000, '答對 → 1 天後到期');
  // 個人片語 + 圖片 + 筆記 + 刪除連動
  await p.evaluate(() => { state.quiz = null; state.tab = 'library'; render(); });
  await p.click('#newEntry'); await p.fill('#ap', 'brush up on'); await p.fill('#az', '複習加強'); await p.fill('#ae', 'I brushed up on my English.'); await p.click('#save');
  await p.waitForFunction(() => entries.some(e => e.phrase === 'brush up on'));
  const uid = await p.evaluate(() => entries.find(e => e.phrase === 'brush up on').id);
  await p.evaluate(id => detail(id), uid); await p.waitForSelector('#note');
  assert((await p.innerHTML('article.panel p')).includes('<span class="red"'), '自建片語例句也有標示');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const pngPath = path.join(require('os').tmpdir(), 'pm-e2e.png'); fs.writeFileSync(pngPath, png);
  await p.setInputFiles('#upload', pngPath); await p.waitForTimeout(300);
  await p.fill('#note', 'mine'); await p.click('#saveNote');
  await p.click('#deleteEntry'); await p.waitForTimeout(300);
  const left = await p.evaluate(async id => ({ m: (await all('media')).filter(x => x.phraseId === id).length, n: await get('notes', id) }), uid);
  assert(left.m === 0 && !left.n, '刪除自建片語時一併刪除其圖片與筆記');
  // 筆記 + 圖片在預載片語 → 重新整理 → 備份 → 清空 → 還原
  await p.evaluate(() => detail('seed:up/give-up')); await p.waitForSelector('#note');
  await p.fill('#note', 'keep me'); await p.click('#saveNote');
  await p.setInputFiles('#upload', pngPath); await p.waitForTimeout(300);
  await p.reload(); await p.evaluate(() => detail('seed:up/give-up')); await p.waitForSelector('#note');
  assert(await p.inputValue('#note') === 'keep me' && (await p.$$('img.thumb')).length >= 1, '重新整理後筆記與圖片仍在');
  await p.click('#back'); await p.click('text=備份／匯入');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#export')]);
  const bk = path.join(require('os').tmpdir(), 'pm-e2e-backup.json'); await dl.saveAs(bk);
  await p.evaluate(() => new Promise(r => { db.close(); indexedDB.deleteDatabase('phrasemap-personal-v1').onsuccess = r; }));
  await p.reload(); await p.click('text=備份／匯入'); await p.setInputFiles('#import', bk);
  await p.waitForFunction(() => document.getElementById('status').textContent);
  await p.evaluate(() => detail('seed:up/give-up')); await p.waitForSelector('#note');
  assert(await p.inputValue('#note') === 'keep me' && (await p.$$('img.thumb')).length >= 1, '備份 → 清空 → 匯入後完整還原');
  await p.setViewportSize({ width: 375, height: 800 }); await p.click('#back');
  assert(await p.evaluate(() => document.documentElement.scrollWidth) <= 375, '手機寬度沒有水平捲動');
  await ctx.close();

  // ── 模擬 Android App ──
  console.log('Android App（模擬原生橋接）');
  const actx = await b.newContext();
  await actx.addInitScript(NATIVE_MOCK);
  const a = await actx.newPage();
  a.on('pageerror', e => errs.push(e.message));
  a.on('dialog', d => d.accept());
  await a.route('https://raw.githubusercontent.com/**', r => r.abort());
  await a.goto(URL()); await a.waitForSelector('[data-group]');
  const anav = await a.$$eval('[data-tab]', x => x.map(t => t.dataset.tab));
  assert(anav.includes('ai') && anav.includes('articles'), 'App 顯示 AI 設定與 AI 文章');
  await a.click('[data-tab="ai"]'); await a.waitForSelector('#prov');
  assert((await a.textContent('#view')).includes('內建備援'), '遠端模型清單失敗時用內建備援');
  await a.click('#setKey'); await a.waitForTimeout(200);
  assert((await a.textContent('#prov')).includes('已設定金鑰'), '原生對話框設定金鑰後顯示已設定');
  await a.click('#test'); await a.waitForFunction(() => document.getElementById('aiStatus').textContent.includes('成功'));
  const call = await a.evaluate(() => window.__calls[0]);
  assert(call.provider === 'GEMINI' && /^\/v1beta\/models\/[^/]+:generateContent$/.test(call.p) && !call.body.includes('"k"'), 'Gemini 呼叫走原生橋接，網頁端不含金鑰');
  await a.selectOption('#prov', 'NVIDIA'); await a.waitForTimeout(200);
  await a.click('#setKey'); await a.waitForTimeout(200);
  await a.click('#test'); await a.waitForFunction(() => document.getElementById('aiStatus').textContent.includes('成功'));
  assert(await a.evaluate(() => window.__calls.at(-1).p) === '/chat/completions', 'NVIDIA 使用 OpenAI 相容格式');
  await a.selectOption('#prov', 'GEMINI'); await a.waitForTimeout(200);
  // AI 解說
  await a.evaluate(() => detail('seed:up/give-up')); await a.waitForSelector('#aiExplain');
  await a.click('#aiExplain'); await a.waitForSelector('#aiToNote');
  await a.click('#aiToNote'); await a.waitForTimeout(200);
  assert((await a.evaluate(() => get('notes', 'seed:up/give-up'))).text.includes('【AI 解說】'), 'AI 解說可加入筆記');
  // 系列文章
  await a.click('#back'); await a.click('[data-tab="articles"]');
  await a.selectOption('#agroup', 'UP'); await a.waitForSelector('.checks');
  await a.selectOption('#count', '2'); await a.click('#gen');
  await a.waitForFunction(() => document.querySelectorAll('[data-article]').length === 2 || /失敗/.test(document.getElementById('genLog')?.textContent||''), null, { timeout: 10000 }).catch(async e => { console.log(await a.evaluate(() => document.getElementById('view').innerText.slice(0, 1500))); throw e; });
  const arts = await a.evaluate(() => all('articles'));
  assert(arts.length === 2 && arts.every(x => x.seriesTitle === '測試系列'), '大綱 → 逐篇生成 2 篇並存入閱讀庫');
  const union = new Set(arts.flatMap(x => x.phraseIds));
  assert(union.size === 6, '6 個目標片語都分配到某一篇');
  assert(arts.some(x => x.status === 'needs_review') && arts.every(x => x.annotations.length > 0), '有標註；沒用到的片語標成待審核');
  const first = arts.find(x => x.order === 0);
  await a.evaluate(id => readArticle(id), first.id); await a.waitForSelector('#toggle');
  assert(await a.$$eval('.article .red', x => x.length) > 0 && await a.$$eval('.article .particle', x => x.length) > 0, '文章動詞紅字、小詞底線');
  assert((await a.innerHTML('.article')).includes('>gave</span>'), '可分離＋過去式（gave it up）正確標示');
  await a.click('#toggle'); await a.waitForTimeout(100);
  assert(await a.$$eval('.article .red', x => x.length) === 0, '可切換隱藏標示');
  await a.click('#edit'); await a.fill('#ex', 'We gave up. They set up a stall.'); await a.click('#es'); await a.waitForSelector('#toggle');
  const edited = await a.evaluate(id => get('articles', id), first.id);
  assert(edited.text.startsWith('We gave up') && edited.annotations.length >= 2, '編輯內文後重新標註');
  await a.click('#regen'); await a.waitForTimeout(400);
  assert((await a.evaluate(id => get('articles', id), first.id)).text !== edited.text, '單篇可重新生成');
  await a.evaluate(() => detail('seed:up/give-up')); await a.waitForSelector('#note');
  // 備份走原生儲存，且不含金鑰
  await a.click('#back'); await a.click('text=備份／匯入'); await a.click('#export');
  await a.waitForFunction(() => window.__saved);
  const saved = await a.evaluate(() => window.__saved);
  const obj = JSON.parse(saved.text);
  assert(obj.version === 3 && obj.stores.articles.length === 2 && !/"k"|apiKey/.test(saved.text), '原生儲存備份（含文章、不含金鑰）');
  await actx.close();
  assert(errs.length === 0, '沒有頁面錯誤' + (errs.length ? '：' + errs.join(' | ') : ''));
  await b.close(); srv.close();
  console.log('E2E 全部通過');
})().catch(e => { console.error(e.message); process.exit(1); });
