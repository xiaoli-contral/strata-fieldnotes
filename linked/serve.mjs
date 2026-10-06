// New local page that chains the intro, the Jilin map, Zuojia Shan, and Shoushan.
// It reads the existing pages and does not write back to them.
import http from 'node:http';
import {existsSync} from 'node:fs';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {synthesizeSpeech} from '../scripts/edge-speech.mjs';
import {guideLinesEn, shoushanSpeech, voices} from './phrases.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4330);
const mapPort = Number(process.env.MAP_PORT || 4317);
const tunnel = process.env.INTRO_ORIGIN || 'https://steven-libs-goes-patch.trycloudflare.com';
const shoushanRoot = process.env.SHOUSHAN_ROOT || '/Users/libinghuan/Documents/Codex/2026-09-29/hao-d-worktrees/enlarge-return-button';
const introCache = path.join(root, '.runtime/linked-intro');
const speechCache = path.join(root, '.runtime/linked-speech');
const bootTag = '<script type="module" src="/linked/boot.js"></script>';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary',
  '.spz': 'application/octet-stream',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm'
};

export function readLang(req, url) {
  const query = url.searchParams.get('lang');
  if (query === 'en' || query === 'zh') return query;
  const cookie = String(req.headers.cookie || '');
  const match = cookie.match(/(?:^|;\s*)strata-lang=(en|zh)(?:;|$)/);
  return match ? match[1] : 'zh';
}

export function rewriteIntroHtml(html) {
  return html
    .replace('href="../3js/"', 'href="/v06b/map/index.html"')
    .replace('</body>', '<script type="module" src="/linked/intro-cta.js"></script></body>');
}

export function injectBoot(html) {
  if (html.includes('/linked/boot.js')) return html;
  if (html.includes('<head>')) return html.replace('<head>', `<head>${bootTag}`);
  return `${bootTag}${html}`;
}

const linkedScripts = new Set(['/linked/boot.js', '/linked/intro-cta.js', '/linked/shoushan-voice.js', '/linked/phrases.mjs', '/linked/map-host.js']);

export function rewriteMapHtml(html) {
  const withHost = html.includes('/map-walk-host.js')
    ? html.replace('<script src="/map-walk-host.js"></script>', '<script src="/linked/map-host.js"></script>')
    : html.replace('</head>', '<script src="/linked/map-host.js"></script>\n</head>');
  return injectBoot(withHost);
}

const caveCover = '<div id="linkedCaveLoading" role="status" aria-live="polite" style="position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#161512;color:#f4ecd8;font:500 18px/1.5 sans-serif;transition:opacity .5s"><p id="linkedCaveLabel" style="margin:0">正在进入寿山仙人洞</p><div style="width:min(420px,70vw);height:6px;border-radius:3px;background:#3a352b;overflow:hidden"><div id="linkedCaveBar" style="width:8%;height:100%;background:#e8d49a;transition:width .4s"></div></div><small style="opacity:.7;font-size:12px">Esc 返回地图</small></div>';

export function rewriteShoushanHtml(html) {
  const linked = html.replace(
    '走近标记，会读到一句。句子对照博物院展牌和一九九三年发掘报告。旧录音还是上一稿，先不放。远景已经接上。地图还没有接。',
    '走近标记，会读到一句。句子对照博物院展牌和一九九三年发掘报告。'
  ).replace('<body>', `<body>${caveCover}`);
  return injectBoot(linked).replace('</body>', '<script type="module" src="/linked/shoushan-voice.js"></script></body>');
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(body);
}
function json(res, status, data) {
  send(res, status, JSON.stringify(data), 'application/json; charset=utf-8');
}
function typeOf(file) {
  return mime[path.extname(file).toLowerCase()] || 'application/octet-stream';
}
// First reads from this folder can take seconds per file (cloud-synced disk),
// so heavy assets are kept in memory and the browser may cache them.
const heavy = /\.(glb|spz|png|jpe?g|webp|woff2|mp3|wasm)$/i;
const memory = new Map();
function readKept(file) {
  if (!heavy.test(file)) return readFile(file);
  if (!memory.has(file)) memory.set(file, readFile(file).catch(error => { memory.delete(file); throw error; }));
  return memory.get(file);
}
async function streamFile(res, file) {
  const body = await readKept(file);
  res.writeHead(200, {
    'Content-Type': typeOf(file),
    'Content-Length': body.length,
    'Cache-Control': heavy.test(file) ? 'public, max-age=86400' : 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

const upstreamKept = new Map();
function keptUpstream(target) {
  if (!upstreamKept.has(target)) {
    upstreamKept.set(target, fetch(`http://127.0.0.1:${mapPort}${target}`, {signal: AbortSignal.timeout(180000)})
      .then(async response => {
        if (!response.ok) throw new Error(String(response.status));
        return {type: response.headers.get('content-type') || typeOf(target), body: Buffer.from(await response.arrayBuffer())};
      })
      .catch(error => { upstreamKept.delete(target); throw error; }));
  }
  return upstreamKept.get(target);
}
export function keepsUpstream(pathname) {
  return pathname === '/viewer.bundle.js' || /^\/generated\/[A-Za-z0-9_./-]+\.(glb|spz|png|jpe?g)$/.test(pathname);
}

const shoushanAssets = ['world-splat.spz', 'world-collider.glb', 'stone.glb', 'bone.glb'];
async function zuojiaAssets() {
  const [world, near] = await Promise.all(['/api/river-world/status', '/api/nearfield/status'].map(target =>
    fetch(`http://127.0.0.1:${mapPort}${target}`, {signal: AbortSignal.timeout(15000)}).then(response => response.json()).catch(() => ({}))));
  return ['/viewer.bundle.js', world.splat, world.collider, ...Object.values(near.assets || {}), '/generated/rigging/standingGuide-rigged-v1.glb'].filter(Boolean);
}
async function prefetchList() {
  const plates = ['cave-ai', 'zuojia-ai', 'xing-ai', 'hou-ai'];
  const images = [];
  for (const dir of plates) for (const name of ['overview', 'mouth', 'tools', 'bones', 'dwell', 'dragon', 'pots', 'houses', 'house', 'wares', 'stone', 'bronze']) {
    if (existsSync(path.join(root, 'public/v06b', dir, `${name}.png`))) images.push(`/v06b/${dir}/${name}.png`);
  }
  return {
    images,
    shoushan: shoushanAssets.map(name => `/scenes/shoushan/${name}`),
    zuojia: await zuojiaAssets()
  };
}
async function warm() {
  const list = await prefetchList();
  for (const image of list.images) await readKept(path.join(root, 'public', image.slice(1))).catch(() => {});
  for (const name of shoushanAssets) await readKept(path.join(shoushanRoot, 'outputs/shoushan', name)).catch(() => {});
  for (const target of list.zuojia) await keptUpstream(target).catch(() => {});
  console.log(`warm: ${memory.size} files, ${upstreamKept.size} upstream`);
}

function introRelative(pathname) {
  let rel = decodeURIComponent(pathname.replace(/^\/intro\/?/, ''));
  if (!rel || rel.endsWith('/')) rel += 'index.html';
  if (rel.split('/').includes('..')) return '';
  return rel;
}

async function cachedIntro(rel) {
  const file = path.join(introCache, rel);
  if (!existsSync(file)) {
    const upstream = await fetch(`${tunnel}/intro/${rel}`, {redirect: 'follow', signal: AbortSignal.timeout(30000)});
    if (!upstream.ok) return null;
    await mkdir(path.dirname(file), {recursive: true});
    await writeFile(file, Buffer.from(await upstream.arrayBuffer()));
  }
  return file;
}

function proxyMap(req, res, targetPath) {
  const headers = {...req.headers, host: `127.0.0.1:${mapPort}`};
  delete headers['accept-encoding'];
  const upstream = http.request({hostname: '127.0.0.1', port: mapPort, path: targetPath, method: req.method, headers}, up => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) send(res, 502, '地图服务没有开'); });
  req.pipe(upstream);
}

async function speakFile(id, text, lang) {
  const file = path.join(speechCache, `${lang}-${id}.mp3`);
  if (!existsSync(file)) {
    await mkdir(speechCache, {recursive: true});
    const voice = voices[lang] || voices.zh;
    await writeFile(file, await synthesizeSpeech(text, voice));
  }
  return file;
}

async function englishReply(question) {
  const ask = String(question || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (ask.length < 2) { const error = new Error('Write a short question first.'); error.status = 400; throw error; }
  const known = guideLinesEn.find(line => line.ask && (ask.toLowerCase() === line.ask.toLowerCase() || ask.toLowerCase().includes(line.ask.toLowerCase())));
  if (known) return {id: known.id, text: known.text};
  const key = process.env.DEEPSEEK_API_KEY;
  const fallback = 'What remains does not say. I only know this square house, the needle in my hand, and the gray-brown pot.';
  if (!key) return {id: `live-${createHash('sha256').update(fallback).digest('hex').slice(0, 16)}`, text: fallback};
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: .4,
      max_tokens: 160,
      messages: [
        {role: 'system', content: 'You are a teaching voice inside a square phase-I house at Zuojia Shan, on the Yitong terrace in Nong\'an, Jilin. Eight postholes, a bone needle in your hand, a hand-built gray-brown pot with string marks, mat marks, and zigzag impressions. Speak in the first person, one or two short sentences. If the records do not say, say they do not say. Do not mention the stone dragon. Do not claim farming was the main life. Do not invent names, clothes, the roof, or the weather of a particular day.'},
        {role: 'user', content: ask}
      ]
    }),
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json().catch(() => ({}));
  const text = String(data.choices?.[0]?.message?.content || '').replace(/\s+/g, ' ').trim().slice(0, 280) || fallback;
  return {id: `live-${createHash('sha256').update(text).digest('hex').slice(0, 16)}`, text};
}

async function readBody(req, limit = 65536) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) { const error = new Error('too large'); error.status = 413; throw error; }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const pathname = url.pathname;
    const host = String(req.headers.host || '');
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host)) return send(res, 403, '仅允许本机访问');
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') return send(res, 405, '方法不允许');
    if ((pathname === '/' || pathname === '') && req.method === 'GET') {
      res.writeHead(302, {Location: '/intro/'});
      return res.end();
    }
    if (linkedScripts.has(pathname)) return streamFile(res, path.join(root, 'linked', path.basename(pathname)));
    if (pathname === '/linked/prefetch.json') return json(res, 200, await prefetchList());
    if (req.method === 'GET' && keepsUpstream(pathname)) {
      try {
        const item = await keptUpstream(pathname);
        res.writeHead(200, {'Content-Type': item.type, 'Content-Length': item.body.length, 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff'});
        return res.end(item.body);
      } catch {
        return proxyMap(req, res, req.url);
      }
    }
    if (pathname === '/map-scene-bridge.js') return streamFile(res, path.join(root, 'linked/bridge.js'));
    if (pathname === '/map-scene-bridge.css') return streamFile(res, path.join(root, 'public/map-scene-bridge.css'));
    if (pathname === '/map-walk-host.js') return streamFile(res, path.join(root, 'public/map-walk-host.js'));
    if (pathname.startsWith('/intro/') || pathname === '/intro') {
      const rel = introRelative(pathname);
      if (!rel) return send(res, 400, '路径无效');
      const file = await cachedIntro(rel);
      if (!file) return send(res, 502, '开场页暂时取不到');
      if (path.basename(rel) === 'index.html') {
        const html = rewriteIntroHtml(await readFile(file, 'utf8'));
        return send(res, 200, html, 'text/html; charset=utf-8');
      }
      return streamFile(res, file);
    }
    if (pathname === '/v06b/map/index.html' || pathname === '/v06b/map/') {
      const html = rewriteMapHtml(await readFile(path.join(root, 'public/v06b/map/index.html'), 'utf8'));
      return send(res, 200, html, 'text/html; charset=utf-8');
    }
    if (pathname.startsWith('/v06b/')) {
      const rel = pathname.slice('/v06b/'.length);
      if (!rel || rel.split('/').includes('..')) return send(res, 400, '路径无效');
      const file = path.join(root, 'public/v06b', rel);
      if (!existsSync(file)) return send(res, 404, '未找到资源');
      return streamFile(res, file);
    }
    if (pathname === '/scenes/shoushan/index.html') {
      const html = rewriteShoushanHtml(await readFile(path.join(shoushanRoot, 'public/scenes/shoushan/index.html'), 'utf8'));
      return send(res, 200, html, 'text/html; charset=utf-8');
    }
    if (pathname.startsWith('/scenes/shoushan/')) {
      const rel = decodeURIComponent(pathname.slice('/scenes/shoushan/'.length));
      if (!rel || rel.split('/').includes('..')) return send(res, 400, '路径无效');
      const name = path.basename(rel);
      const model = rel === name && ['stone.glb', 'bone.glb', 'world-collider.glb', 'world-splat.spz'].includes(name);
      const file = model
        ? path.join(shoushanRoot, 'outputs/shoushan', name)
        : path.join(shoushanRoot, 'public/scenes/shoushan', rel);
      if (!existsSync(file)) return send(res, 404, '未找到资源');
      return streamFile(res, file);
    }
    if (pathname === '/field' || pathname === '/field/') {
      const upstream = await fetch(`http://127.0.0.1:${mapPort}/`, {headers: {host: `127.0.0.1:${mapPort}`}, signal: AbortSignal.timeout(15000)});
      const html = injectBoot(await upstream.text());
      return send(res, upstream.ok ? 200 : upstream.status, html, 'text/html; charset=utf-8');
    }
    if (pathname === '/api/guide/lines' && req.method === 'GET') {
      const lang = readLang(req, url);
      if (lang === 'zh') return proxyMap(req, res, '/api/guide/lines');
      return json(res, 200, {voice: 'Aria', lines: guideLinesEn.map(line => ({id: line.id, ask: line.ask, text: line.text, audio: `/api/guide/audio/${line.id}?lang=en`}))});
    }
    if (pathname.startsWith('/api/guide/audio/') && req.method === 'GET') {
      const id = pathname.slice('/api/guide/audio/'.length);
      if (!/^[a-z0-9-]{1,64}$/.test(id)) return send(res, 400, '没有这段声音');
      const lang = readLang(req, url);
      if (lang === 'en') {
        const line = guideLinesEn.find(item => item.id === id);
        const cached = path.join(speechCache, `en-${id}.mp3`);
        if (!line && !existsSync(cached)) return send(res, 404, '这段声音还没准备好');
        const file = line ? await speakFile(id, line.text, 'en') : cached;
        return streamFile(res, file);
      }
      return proxyMap(req, res, pathname);
    }
    if (pathname === '/api/guide/reply' && req.method === 'POST') {
      const lang = readLang(req, url);
      if (lang === 'zh') return proxyMap(req, res, pathname);
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const answer = await englishReply(body.question);
      await speakFile(answer.id, answer.text, 'en');
      return json(res, 200, {text: answer.text, audio: `/api/guide/audio/${answer.id}?lang=en`});
    }
    const speech = pathname.match(/^\/api\/linked-speech\/shoushan\/(place|tools|bone)$/);
    if (speech && req.method === 'GET') {
      const lang = readLang(req, url);
      const text = shoushanSpeech(speech[1], lang);
      if (!text) return send(res, 404, '没有这段声音');
      return streamFile(res, await speakFile(`shoushan-${speech[1]}`, text, lang));
    }
    if (pathname.startsWith('/api/') || pathname.startsWith('/generated/') || pathname.startsWith('/samples/') || ['/app.js', '/style.css', '/generation.css', '/viewer.bundle.js', '/viewer-entry.js', '/map-walk-boot.js', '/landscape.svg', '/index.html'].includes(pathname)) {
      return proxyMap(req, res, req.url);
    }
    return send(res, 404, '未找到资源');
  } catch (error) {
    if (res.headersSent) return;
    send(res, error.status || 500, error.status ? error.message : '页面没有接上');
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(port, '127.0.0.1', () => {
    console.log(`Linked preview: http://127.0.0.1:${port}/intro/`);
    warm().catch(error => console.warn('warm failed', error.message));
  });
}
