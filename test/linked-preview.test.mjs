import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {translate} from '../linked/phrases.mjs';
import {readLang, rewriteIntroHtml, rewriteShoushanHtml, injectBoot} from '../linked/serve.mjs';

test('intro enters the linked map and keeps the language choice', () => {
  const html = rewriteIntroHtml('<a class="cta-btn" href="../3js/">进入吉林文明地图</a></body>');
  assert.equal(html.includes('../3js/'), false);
  assert.match(html, /href="\/v06b\/map\/index\.html"/);
  assert.match(html, /\/linked\/intro-cta\.js/);
});

test('map and shoushan pages receive the language boot', async () => {
  const map = injectBoot(await readFile(new URL('../public/v06b/map/index.html', import.meta.url), 'utf8'));
  assert.match(map, /<head><script type="module" src="\/linked\/boot\.js"><\/script>/);
  const shoushan = rewriteShoushanHtml(await readFile('/Users/libinghuan/Documents/Codex/2026-09-29/hao-d-worktrees/enlarge-return-button/public/scenes/shoushan/index.html', 'utf8'));
  assert.match(shoushan, /\/linked\/boot\.js/);
  assert.match(shoushan, /\/linked\/shoushan-voice\.js/);
  assert.equal(shoushan.includes('地图还没有接'), false);
});

function chineseLiterals(code) {
  const found = new Set();
  const cjk = /[\u4e00-\u9fff]/g;
  let match, last = -1;
  while ((match = cjk.exec(code))) {
    if (match.index <= last) continue;
    let start = match.index, end = match.index;
    while (start > 0 && !'"`\n'.includes(code[start - 1])) start--;
    while (end < code.length && !'"`\n'.includes(code[end])) end++;
    last = end;
    if (end - start < 200) found.add(code.slice(start, end));
  }
  return found;
}

test('every Chinese map string has an English line', async () => {
  const files = ['map-Bz2mJyq1.js', 'AiPlateScene-BxO_G0g0.js', 'CaveScene-D-fK-yaT.js', 'ZuojiaScene-DwCueqyE.js', 'XingchengScene-DGJvW7Ud.js', 'HoutaipingScene-Ca851Bfh.js'];
  const missed = [];
  for (const file of files) {
    const code = await readFile(new URL(`../public/v06b/assets/${file}`, import.meta.url), 'utf8');
    for (const item of chineseLiterals(code)) {
      if (/[{}$]/.test(item) || item === '市') continue;
      const english = translate(item);
      if (!english || /[\u4e00-\u9fff]/.test(english)) missed.push(item);
    }
  }
  assert.deepEqual(missed, []);
  assert.equal(translate('已观察 2 / 3'), 'Seen 2 / 3');
  assert.equal(translate('进入寿山仙人洞 →'), 'Enter Shoushan Xianrendong →');
  assert.equal(translate('兴城二期 · 3D 漫游筹备中'), 'Xingcheng phase II · 3D walk still in preparation');
  assert.equal(translate('zh'), null);
});

test('language follows the intro choice, then the page query', () => {
  assert.equal(readLang({headers: {}}, new URL('http://127.0.0.1/map')), 'zh');
  assert.equal(readLang({headers: {cookie: 'strata-lang=en'}}, new URL('http://127.0.0.1/map')), 'en');
  assert.equal(readLang({headers: {cookie: 'strata-lang=en'}}, new URL('http://127.0.0.1/map?lang=zh')), 'zh');
});

test('linked bridge opens shoushan and the original bridge is untouched', async () => {
  const linked = await readFile(new URL('../linked/bridge.js', import.meta.url), 'utf8');
  const original = await readFile(new URL('../public/map-scene-bridge.js', import.meta.url), 'utf8');
  assert.match(linked, /"0-2": \{name: "寿山仙人洞", ready: true/);
  assert.match(linked, /\/scenes\/shoushan\/index\.html\?from=map-v06b/);
  assert.match(linked, /\/field\/\?scene=zuojiashan-phase1/);
  assert.match(original, /'0-2':\{name:'寿山仙人洞',ready:false\}/);
});
