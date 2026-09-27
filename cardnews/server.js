#!/usr/bin/env node
// 카드뉴스 로컬 서버 (AI 브리지) — Node.js 18+ 내장 모듈만 사용, 의존성 0
// 엔드포인트: GET / (정적) · GET /ping · POST /convert · POST /img-gen · GET /img-search · GET /img?url=
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const PORT = Number(process.env.PORT) || 8787;
const HOST = '0.0.0.0';
const ROOT = __dirname;
const EDITOR = path.join(ROOT, 'editor');
const TOOLS = path.join(ROOT, 'tools');
const GEN = path.join(EDITOR, 'assets', 'gen');
const IS_WIN = process.platform === 'win32';

const CONVERT_TIMEOUT = 240e3;
const CODEX_TIMEOUT = 6 * 60e3;
const MAX_BODY = 512 * 1024;
const MAX_PROXY_BYTES = 20 * 1024 * 1024;
const CARD_TYPES = new Set(['cover', 'content', 'quote', 'table', 'closing']);
const FIXED_CTA = { cta1: 'AI 커뮤니티 참여하기', cta2: '댓글에 *AIMAX* 남기기' };

const IMG_SUFFIX =
  ' Photorealistic, cinematic lighting, vertical portrait composition. ' +
  'Absolutely no text, no letters, no numbers, no logos, no watermark, no signage. ' +
  'Keep the lower third calm and darker so white text can be overlaid.';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

fs.mkdirSync(GEN, { recursive: true });

// ───────────────────────── 키/기능 감지 ─────────────────────────

// tools/<name>-key.txt — 요청마다 재로딩. 1줄=키, 2줄=모델 오버라이드. 플레이스홀더("여기에…")·주석 무시
function readKey(name) {
  let raw;
  try { raw = fs.readFileSync(path.join(TOOLS, `${name}-key.txt`), 'utf8'); } catch { return null; }
  const lines = raw.replace(/^﻿/, '').split(/\r?\n/).map((s) => s.trim());
  const key = lines[0] || '';
  if (!key || key.startsWith('#') || key.includes('여기에') || /\s/.test(key)) return null;
  const model = lines[1] && !lines[1].startsWith('#') && !lines[1].includes('여기에') ? lines[1] : null;
  return { key, model };
}

function codexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}
function hasCodex() {
  return fs.existsSync(path.join(codexHome(), 'auth.json'));
}

function commandExists(cmd) {
  try {
    const r = spawnSync(IS_WIN ? 'where' : 'which', [cmd], { stdio: 'ignore', shell: IS_WIN });
    return r.status === 0;
  } catch { return false; }
}
const HAS_CLAUDE = commandExists('claude');
const HAS_CODEX_CLI = commandExists('codex');

function caps() {
  return {
    ok: true,
    claude: HAS_CLAUDE,
    pexels: !!readKey('pexels'),
    codex: HAS_CODEX_CLI && hasCodex(),
    gemini: !!readKey('gemini'),
    openai: !!readKey('openai'),
  };
}

// ───────────────────────── HTTP 유틸 ─────────────────────────

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('요청 본문이 너무 큽니다 (최대 512KB)'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJSON(req) {
  const raw = await readBody(req);
  try { return JSON.parse(raw || '{}'); } catch { throw Object.assign(new Error('JSON 형식 오류'), { status: 400 }); }
}

// 자식 프로세스 실행: 프롬프트는 반드시 stdin으로 전달 (shell:true 인자 전달 시 인용부호 깨짐 방지)
function runCli(cmd, args, { input, cwd, timeout }) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd, shell: IS_WIN, windowsHide: true, env: process.env });
    } catch (e) { reject(e); return; }
    let out = '', err = '', done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      child.kill();
      reject(new Error(`${cmd} 응답 시간 초과 (${Math.round(timeout / 1000)}초)`));
    }, timeout);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => {
      if (done) return;
      done = true; clearTimeout(timer);
      reject(e.code === 'ENOENT' ? new Error(`${cmd} CLI를 찾을 수 없습니다 (PATH 확인)`) : e);
    });
    child.on('close', (code) => {
      if (done) return;
      done = true; clearTimeout(timer);
      if (code !== 0) {
        const tail = (err || out).trim().split(/\r?\n/).slice(-6).join('\n');
        reject(new Error(`${cmd} 종료 코드 ${code}${tail ? `: ${tail}` : ''}`));
        return;
      }
      resolve({ out, err });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input || '');
  });
}

// ───────────────────────── /convert ─────────────────────────

function extractJSON(text) {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('AI 응답에서 JSON을 찾지 못했습니다');
  try { return JSON.parse(text.slice(a, b + 1)); } catch (e) { throw new Error(`AI 응답 JSON 파싱 실패: ${e.message}`); }
}

const str = (v) => (v == null ? '' : String(v)).replace(/\\n/g, '\n').trim();

function normalizeDeck(raw) {
  const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.slides) ? raw.slides : null;
  if (!list || !list.length) throw new Error('AI 응답에 slides 배열이 없습니다');
  const slides = [];
  for (const s of list) {
    if (!s || !CARD_TYPES.has(s.type)) continue;
    const src = s.f && typeof s.f === 'object' ? s.f : s;
    const f = {};
    for (const [k, v] of Object.entries(src)) {
      if (k === 'type' || k === 'f') continue;
      if (k === 'rows' && Array.isArray(v)) {
        f.rows = v.map((r) => (Array.isArray(r) ? r.map(str).join(' | ') : str(r))).join('\n');
      } else if (typeof v === 'string' || typeof v === 'number') {
        f[k] = str(v);
      }
    }
    if (s.type === 'closing') Object.assign(f, FIXED_CTA);
    slides.push({ type: s.type, f });
  }
  if (!slides.length) throw new Error('유효한 카드가 없습니다 (type 확인)');
  // 단계 번호는 순서대로 다시 매김 (AI가 01, 01, 02… 처럼 중복시키는 경우 방지)
  let step = 0;
  for (const s of slides) if (s.type === 'content' && s.f.num) s.f.num = String(++step).padStart(2, '0');
  if (slides[slides.length - 1].type !== 'closing') {
    slides.push({ type: 'closing', f: { head: '더 많은 AI 활용법이\n궁금하다면', desc: '', ...FIXED_CTA, hint: '저장해두고 필요할 때 꺼내보세요' } });
  }
  return { bg: str(raw && raw.bg), slides };
}

async function handleConvert(req, res) {
  const { text } = await readJSON(req);
  if (!text || !String(text).trim()) return sendJSON(res, 400, { ok: false, error: '변환할 글이 비어 있습니다' });
  if (!HAS_CLAUDE) return sendJSON(res, 503, { ok: false, error: '호스트에 claude CLI가 없습니다 (Claude Code 설치·로그인 필요)' });
  const prompt = fs.readFileSync(path.join(TOOLS, 'deck-prompt.md'), 'utf8');
  const input = `${prompt}\n\n---\n# 원문\n\n${String(text).trim()}\n`;
  const t0 = Date.now();
  const { out } = await runCli('claude', ['-p', '--output-format', 'text'], { input, cwd: ROOT, timeout: CONVERT_TIMEOUT });
  const deck = normalizeDeck(extractJSON(out));
  log(`convert ✓ ${deck.slides.length}장 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  sendJSON(res, 200, { ok: true, deck });
}

// ───────────────────────── /img-gen ─────────────────────────

function genName(ext = 'png') {
  return `gen-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
}
function saveGen(buf, ext = 'png') {
  const name = genName(ext);
  fs.writeFileSync(path.join(GEN, name), buf);
  return `assets/gen/${name}`;
}

async function genCodex(prompt) {
  const work = fs.mkdtempSync(path.join(GEN, 'codex-'));
  const target = 'bg.png';
  const input = [
    '$imagegen',
    '아래 설명으로 이미지 1장을 생성해 현재 작업 폴더에 정확히 `bg.png` 파일명으로 저장하세요.',
    '- 크기: 1024x1536 (세로)',
    '- 이미지 안에 글자·숫자·로고·워터마크 금지',
    '- 다른 파일은 만들지 말고, 저장 후 파일 경로만 한 줄로 출력',
    '',
    `설명: ${prompt}${IMG_SUFFIX}`,
  ].join('\n');
  const t0 = Date.now();
  try {
    await runCli('codex', ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-'], { input, cwd: work, timeout: CODEX_TIMEOUT });
    let file = path.join(work, target);
    if (!fs.existsSync(file)) file = newestImage(work, t0) || newestImage(path.join(codexHome(), 'generated_images'), t0);
    if (!file) throw new Error('Codex가 이미지를 저장하지 않았습니다');
    return saveGen(fs.readFileSync(file), path.extname(file).slice(1).toLowerCase() || 'png');
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// dir 이하(깊이 3)에서 since 이후 수정된 가장 최신 이미지
function newestImage(dir, since, depth = 0) {
  let best = null, bestT = since;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && depth < 3) {
      const sub = newestImage(p, bestT, depth + 1);
      if (sub) { best = sub; bestT = fs.statSync(sub).mtimeMs; }
    } else if (/\.(png|jpe?g|webp)$/i.test(e.name)) {
      const t = fs.statSync(p).mtimeMs;
      if (t >= bestT) { best = p; bestT = t; }
    }
  }
  return best;
}

async function genGemini(prompt) {
  const k = readKey('gemini');
  const models = [k.model || 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'];
  let lastErr;
  for (const model of [...new Set(models)]) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k.key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt + IMG_SUFFIX }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '4:5' } },
      }),
    });
    if (r.status === 404) { lastErr = new Error(`Gemini 모델 없음: ${model}`); log(`gemini ${model} 404 → 폴백`); continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(j.error && j.error.message) || r.statusText}`);
    const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    const img = parts.find((p) => p.inlineData || p.inline_data);
    if (!img) throw new Error('Gemini 응답에 이미지가 없습니다');
    const d = img.inlineData || img.inline_data;
    const ext = /jpe?g/.test(d.mimeType || d.mime_type || '') ? 'jpg' : 'png';
    return saveGen(Buffer.from(d.data, 'base64'), ext);
  }
  throw lastErr;
}

async function genOpenAI(prompt) {
  const k = readKey('openai');
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k.key}` },
    body: JSON.stringify({ model: k.model || 'gpt-image-2', prompt: prompt + IMG_SUFFIX, size: '1024x1536', quality: 'medium', n: 1 }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(j.error && j.error.message) || r.statusText}`);
  const b64 = j.data && j.data[0] && j.data[0].b64_json;
  if (!b64) throw new Error('OpenAI 응답에 이미지가 없습니다');
  return saveGen(Buffer.from(b64, 'base64'), 'png');
}

const GEN_ROUTES = { codex: genCodex, gemini: genGemini, openai: genOpenAI };

async function handleImgGen(req, res) {
  const { prompt, provider } = await readJSON(req);
  if (!prompt || !String(prompt).trim()) return sendJSON(res, 400, { ok: false, error: 'prompt가 비어 있습니다' });
  const c = caps();
  const order = provider ? [provider] : ['codex', 'gemini', 'openai'];
  const avail = order.filter((p) => GEN_ROUTES[p] && c[p]);
  if (!avail.length) return sendJSON(res, 503, { ok: false, error: '이미지 생성 수단이 없습니다 (Codex 로그인 또는 tools/gemini-key.txt · openai-key.txt)' });
  const errors = [];
  for (const p of avail) {
    const t0 = Date.now();
    try {
      const url = await GEN_ROUTES[p](String(prompt).trim().slice(0, 2000));
      log(`img-gen ✓ ${p} ${url} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      return sendJSON(res, 200, { ok: true, url, provider: p });
    } catch (e) {
      log(`img-gen ✗ ${p}: ${e.message}`);
      errors.push(`${p}: ${e.message}`);
    }
  }
  sendJSON(res, 502, { ok: false, error: errors.join(' / ') });
}

// ───────────────────────── /img-search ─────────────────────────

async function handleImgSearch(req, res, q) {
  q = (q || '').trim();
  if (!q) return sendJSON(res, 400, { ok: false, error: '검색어가 비어 있습니다' });
  const pexels = readKey('pexels');
  if (pexels) {
    const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=portrait&per_page=30`, {
      headers: { Authorization: pexels.key },
    });
    if (r.ok) {
      const j = await r.json();
      const items = (j.photos || []).map((p) => ({
        thumb: p.src.medium, full: p.src.large2x || p.src.portrait || p.src.original,
        credit: p.photographer, link: p.url,
      }));
      return sendJSON(res, 200, { ok: true, source: 'pexels', items });
    }
    log(`img-search pexels ${r.status} → Openverse 폴백`);
  }
  // Openverse 무키: 익명 page_size 최대 20, 세로는 aspect_ratio=tall
  const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=20&aspect_ratio=tall`, {
    headers: { 'User-Agent': 'cardnews-editor/1.0' },
  });
  if (!r.ok) return sendJSON(res, 502, { ok: false, error: `Openverse ${r.status}` });
  const j = await r.json();
  const items = (j.results || []).map((p) => ({
    thumb: p.thumbnail || p.url, full: p.url,
    credit: [p.creator, p.license && `CC ${String(p.license).toUpperCase()}`].filter(Boolean).join(' · '),
    link: p.foreign_landing_url,
  }));
  sendJSON(res, 200, { ok: true, source: 'openverse', items });
}

// ───────────────────────── /img?url= (CORS 프록시) ─────────────────────────

const proxyCache = new Map(); // url → { t, type, buf }
const PROXY_TTL = 24 * 3600e3;
const PROXY_CACHE_MAX = 80;

function isBlockedHost(host) {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  return h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h === '::1' || /^f[cd][0-9a-f]{2}:/.test(h) || /^fe80:/.test(h);
}

async function handleImgProxy(req, res, target) {
  let u;
  try { u = new URL(target); } catch { return sendJSON(res, 400, { ok: false, error: 'url 형식 오류' }); }
  if (u.protocol !== 'https:') return sendJSON(res, 400, { ok: false, error: 'https URL만 허용됩니다' });
  if (isBlockedHost(u.hostname)) return sendJSON(res, 403, { ok: false, error: '허용되지 않는 호스트' });

  const hit = proxyCache.get(u.href);
  if (hit && Date.now() - hit.t < PROXY_TTL) return sendImage(res, hit.type, hit.buf);

  const r = await fetch(u.href, { redirect: 'follow', headers: { 'User-Agent': 'cardnews-editor/1.0', Accept: 'image/*' } });
  if (!r.ok) return sendJSON(res, 502, { ok: false, error: `원본 ${r.status}` });
  if (!new URL(r.url).protocol.startsWith('https')) return sendJSON(res, 400, { ok: false, error: 'https가 아닌 곳으로 리다이렉트됨' });
  const type = (r.headers.get('content-type') || '').split(';')[0].trim();
  if (!type.startsWith('image/') || type.includes('svg')) return sendJSON(res, 415, { ok: false, error: `이미지가 아닙니다 (${type || '알 수 없음'})` });
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_PROXY_BYTES) return sendJSON(res, 413, { ok: false, error: '이미지가 너무 큽니다 (최대 20MB)' });

  proxyCache.set(u.href, { t: Date.now(), type, buf });
  if (proxyCache.size > PROXY_CACHE_MAX) proxyCache.delete(proxyCache.keys().next().value);
  sendImage(res, type, buf);
}

function sendImage(res, type, buf) {
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=86400' });
  res.end(buf);
}

// ───────────────────────── 정적 파일 ─────────────────────────

function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { res.writeHead(400); return res.end('bad path'); }
  if (rel.includes('\0')) { res.writeHead(400); return res.end('bad path'); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(EDITOR, '.' + path.posix.normalize('/' + rel));
  // path traversal 방어: 반드시 editor/ 내부
  if (file !== EDITOR && !file.startsWith(EDITOR + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('not found'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

// ───────────────────────── 라우터 ─────────────────────────

function log(msg) {
  const t = new Date().toTimeString().slice(0, 8);
  console.log(`[${t}] ${msg}`);
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  try {
    if (p === '/ping' && req.method === 'GET') return sendJSON(res, 200, caps());
    if (p === '/convert' && req.method === 'POST') return await handleConvert(req, res);
    if (p === '/img-gen' && req.method === 'POST') return await handleImgGen(req, res);
    if (p === '/img-search' && req.method === 'GET') return await handleImgSearch(req, res, url.searchParams.get('q'));
    if (p === '/img' && req.method === 'GET') return await handleImgProxy(req, res, url.searchParams.get('url') || '');
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, p);
    sendJSON(res, 405, { ok: false, error: 'method not allowed' });
  } catch (e) {
    log(`${req.method} ${p} ✗ ${e.message}`);
    if (!res.headersSent) sendJSON(res, e.status || 500, { ok: false, error: e.message });
    else res.end();
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n❌ 포트 ${PORT}이(가) 이미 사용 중입니다.`);
    console.error('   · 이미 서버가 켜져 있다면 그 창을 그대로 쓰세요 (브라우저에서 http://localhost:' + PORT + '/).');
    console.error('   · 다른 프로그램이 쓰고 있다면 PORT 환경변수로 바꿔 실행하세요.  예) set PORT=8788 && node server.js\n');
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, HOST, () => {
  const c = caps();
  const lan = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) lan.push(a.address);
  }
  const on = (b) => (b ? '✅' : '—');
  console.log('\n🃏 카드뉴스 에디터 서버');
  console.log(`   내 PC     : http://localhost:${PORT}/`);
  for (const ip of lan) console.log(`   팀원(LAN) : http://${ip}:${PORT}/`);
  console.log('\n   기능 상태');
  console.log(`   ${on(c.claude)} AI 변환 (claude -p)`);
  console.log(`   ${on(c.codex)} 배경 생성 · Codex OAuth (ChatGPT 구독)`);
  console.log(`   ${on(c.gemini)} 배경 생성 · Gemini 키 (tools/gemini-key.txt)`);
  console.log(`   ${on(c.openai)} 배경 생성 · OpenAI 키 (tools/openai-key.txt)`);
  console.log(`   ${c.pexels ? '✅ 스톡 검색 · Pexels' : '✅ 스톡 검색 · Openverse (무키 폴백)'}`);
  console.log('\n   ⚠️  인증 없는 사내 LAN 전용 서버입니다. 공인망에 노출하지 마세요.\n');
});
