// PhraseMap 共用核心：詞形變化、token 標註、間隔複習、穩定 ID。
// 瀏覽器：window.PhraseCore；Node 測試：require('./js/core.js')。
(function (root) {
  'use strict';

  // 不規則動詞：原形 → 過去式／過去分詞（其餘 -s / -ing 由規則產生）
  const IRREGULAR_TABLE =
    'be:am,is,are,was,were,been,being|have:has,had,having|do:does,did,done|go:went,gone|get:got,gotten|' +
    'give:gave,given|take:took,taken|come:came|run:ran|find:found|break:broke,broken|think:thought|' +
    'throw:threw,thrown|write:wrote,written|speed:sped|leave:left|bring:brought|buy:bought|catch:caught|' +
    'teach:taught|hold:held|keep:kept|let:let|make:made|mean:meant|meet:met|pay:paid|say:said|send:sent|' +
    'set:set|shut:shut|sit:sat|stand:stood|tell:told|understand:understood|win:won|fall:fell,fallen|' +
    'eat:ate,eaten|draw:drew,drawn|drive:drove,driven|fly:flew,flown|grow:grew,grown|know:knew,known|' +
    'ride:rode,ridden|rise:rose,risen|see:saw,seen|shake:shook,shaken|speak:spoke,spoken|steal:stole,stolen|' +
    'swear:swore,sworn|tear:tore,torn|wear:wore,worn|wake:woke,woken|hang:hung,hanged|dig:dug|stick:stuck|' +
    'strike:struck|swing:swung|spin:spun|sell:sold|blow:blew,blown|bear:bore,born,borne|beat:beaten|' +
    'begin:began,begun|bite:bit,bitten|choose:chose,chosen|forget:forgot,forgotten|freeze:froze,frozen|' +
    'hide:hid,hidden|lay:laid|lie:lay,lain,lying|lead:led|light:lit,lighted|lose:lost|sing:sang,sung|' +
    'sink:sank,sunk|slide:slid|spend:spent|split:split|spread:spread|spring:sprang,sprung|wind:wound|' +
    'fight:fought|seek:sought|build:built|feel:felt|deal:dealt|sleep:slept|sweep:swept|weep:wept|' +
    'hear:heard|feed:fed|flee:fled|bleed:bled|read:read|hit:hit|hurt:hurt|cut:cut|put:put|quit:quit|' +
    'cast:cast|cost:cost|shoot:shot|show:shown|stride:strode|bend:bent|lend:lent|shine:shone|' +
    'swim:swam,swum|drink:drank,drunk|ring:rang,rung|shrink:shrank,shrunk|stink:stank|sting:stung|tread:trod,trodden|creep:crept|kneel:knelt|bind:bound|grind:ground|rewrite:rewrote,rewritten|take:took,taken';
  const IRREGULAR = {};
  for (const part of IRREGULAR_TABLE.split('|')) {
    const [base, list] = part.split(':');
    IRREGULAR[base] = (IRREGULAR[base] || []).concat(list.split(','));
  }
  // 這些動詞沒有規則 -ed 形
  const NO_REGULAR_ED = new Set(Object.keys(IRREGULAR).filter(v => !['hang', 'light', 'wind', 'lay', 'show', 'read'].includes(v)));

  function forms(verb) {
    const v = String(verb || '').toLowerCase();
    const out = new Set([v]);
    (IRREGULAR[v] || []).forEach(f => out.add(f));
    const doubled = /[^aeiou][aeiou][bdgklmnprt]$/.test(v) ? v + v.slice(-1) : v;
    if (/ie$/.test(v)) { out.add(v + 's'); out.add(v + 'd'); out.add(v.slice(0, -2) + 'ying'); }
    else if (/e$/.test(v)) { out.add(v + 's'); if (!NO_REGULAR_ED.has(v)) out.add(v + 'd'); out.add(v.slice(0, -1) + 'ing'); out.add(v + 'ing'); }
    else if (/[^aeiou]y$/.test(v)) { out.add(v.slice(0, -1) + 'ies'); out.add(v.slice(0, -1) + 'ied'); out.add(v + 'ing'); }
    else {
      out.add(/(s|x|z|ch|sh|o)$/.test(v) ? v + 'es' : v + 's');
      if (!NO_REGULAR_ED.has(v)) { out.add(v + 'ed'); out.add(doubled + 'ed'); }
      out.add(v + 'ing'); out.add(doubled + 'ing');
    }
    return out;
  }

  function tokenize(text) {
    const tokens = [];
    const re = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
    let m;
    while ((m = re.exec(text))) tokens.push({ w: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
    return tokens;
  }

  function phraseWords(phrase) {
    return String(phrase || '').toLowerCase().replace(/[()]/g, '').split(/\s+/).map(w => w.replace(/[^a-z']/g, '')).filter(Boolean);
  }

  // 以 token 位移標註：動詞（含變化形）→ 小詞（允許中間夾受詞，不跨句）。
  // entries: [{id, phrase}]；回傳 [{start,end,type:'verb'|'particle',senseId}]
  function annotate(text, entries) {
    text = String(text || '');
    const tokens = tokenize(text);
    const anns = [];
    const used = new Set();
    const crossesSentence = (a, b) => /[.!?;]/.test(text.slice(tokens[a].end, tokens[b].start));
    for (const entry of entries) {
      const words = phraseWords(entry.phrase);
      if (!words.length) continue;
      const verbForms = forms(words[0]);
      const particles = words.slice(1);
      for (let i = 0; i < tokens.length; i++) {
        if (used.has(i) || !verbForms.has(tokens[i].w)) continue;
        if (!particles.length) { anns.push({ start: tokens[i].start, end: tokens[i].end, type: 'verb', senseId: entry.id }); used.add(i); continue; }
        let pos = i;
        const hits = [];
        for (let p = 0; p < particles.length; p++) {
          const maxGap = p === 0 ? 5 : 3; // 第一個小詞前可夾受詞（可分離片語）
          let found = -1;
          for (let k = pos + 1; k <= Math.min(tokens.length - 1, pos + maxGap); k++) {
            if (crossesSentence(pos, k)) break;
            if (!used.has(k) && tokens[k].w === particles[p]) { found = k; break; }
          }
          if (found < 0) { hits.length = 0; break; }
          hits.push(found);
          pos = found;
        }
        if (hits.length === particles.length) {
          anns.push({ start: tokens[i].start, end: tokens[i].end, type: 'verb', senseId: entry.id });
          used.add(i);
          for (const k of hits) { anns.push({ start: tokens[k].start, end: tokens[k].end, type: 'particle', senseId: entry.id }); used.add(k); }
        }
      }
    }
    return anns.sort((a, b) => a.start - b.start);
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderAnnotated(text, anns, show = true) {
    text = String(text || '');
    if (!show || !anns || !anns.length) return esc(text);
    let html = '';
    let at = 0;
    for (const a of anns) {
      if (a.start < at) continue;
      html += esc(text.slice(at, a.start));
      html += '<span class="' + (a.type === 'verb' ? 'red' : 'particle') + '" data-sense="' + esc(a.senseId) + '">' + esc(text.slice(a.start, a.end)) + '</span>';
      at = a.end;
    }
    return html + esc(text.slice(at));
  }

  function highlight(text, phrase) {
    return renderAnnotated(text, annotate(text, [{ id: '', phrase }]));
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function seedId(group, phrase) { return 'seed:' + slug(group) + '/' + slug(phrase); }

  // Leitner 間隔：box 0..6 → 天數
  const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16, 32];
  const DAY = 86400000;
  function schedule(prev, correct, now = Date.now()) {
    const box = correct ? Math.min((prev && prev.box) || 0, INTERVAL_DAYS.length - 2) + 1 : 0;
    return {
      attempts: ((prev && prev.attempts) || 0) + 1,
      correct: ((prev && prev.correct) || 0) + (correct ? 1 : 0),
      wrong: ((prev && prev.wrong) || 0) + (correct ? 0 : 1),
      box,
      due: correct ? now + INTERVAL_DAYS[box] * DAY : now,
      updatedAt: now,
    };
  }
  function isDue(progress, now = Date.now()) { return !progress || !progress.due || progress.due <= now; }

  // AI 回覆清理：移除 <think>，取第一個 { 到最後一個 }
  function extractJson(text) {
    const t = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('AI 回覆不是 JSON');
    return JSON.parse(t.slice(a, b + 1));
  }

  const api = { forms, tokenize, annotate, renderAnnotated, highlight, esc, slug, seedId, schedule, isDue, extractJson, INTERVAL_DAYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhraseCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
