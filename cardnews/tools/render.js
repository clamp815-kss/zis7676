#!/usr/bin/env node
// headless Chrome 일괄 캡처 — DevTools 프로토콜 직접 사용 (의존성 0, Node 22+의 내장 WebSocket)
// 사용: node tools/render.js <덱.json> [스타일] [출력폴더]
// 환경변수: SERVER(기본 http://localhost:8787), CHROME(크롬 경로), CHROME_FLAGS(추가 플래그, 예: --no-sandbox)
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const [deckPath, style = '', outDir = 'out'] = process.argv.slice(2);
if (!deckPath) { console.error('사용법: node tools/render.js <덱.json> [스타일] [출력폴더]'); process.exit(1); }
if (typeof WebSocket === 'undefined') { console.error('Node.js 22 이상이 필요합니다 (내장 WebSocket).'); process.exit(1); }

const SERVER = (process.env.SERVER || 'http://localhost:8787').replace(/\/+$/, '');
const ROOT = path.join(__dirname, '..');
const DECK_REL = 'assets/gen/_render.json';
const DECK_ABS = path.join(ROOT, 'editor', DECK_REL);

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const c = {
    win32: [
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
    ],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  }[process.platform] || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return c.find((p) => p && fs.existsSync(p));
}

function launch(chrome, profile) {
  return new Promise((resolve, reject) => {
    const extra = (process.env.CHROME_FLAGS || '').split(/\s+/).filter(Boolean);
    const proc = spawn(chrome, [...extra, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
      '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let buf = '';
    const t = setTimeout(() => reject(new Error('Chrome 기동 시간 초과')), 20e3);
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); resolve({ proc, ws: m[1] }); }
    });
    proc.on('error', (e) => { clearTimeout(t); reject(e); });
    proc.on('exit', (code) => { clearTimeout(t); reject(new Error(`Chrome이 종료됨 (code ${code})${buf ? `\n${buf.trim().slice(-400)}` : ''}`)); });
  });
}

function cdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      }
    };
    ws.onerror = () => reject(new Error('DevTools 연결 실패'));
    ws.onopen = () => resolve({
      send: (method, params = {}, sessionId) => new Promise((res, rej) => {
        const mid = ++id;
        pending.set(mid, { res, rej });
        ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
      }),
      close: () => ws.close(),
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const chrome = findChrome();
  if (!chrome) throw new Error('Chrome을 찾을 수 없습니다. CHROME 환경변수로 경로를 지정하세요.');
  const ping = await fetch(`${SERVER}/ping`).catch(() => null);
  if (!ping || !ping.ok) throw new Error(`서버(${SERVER})에 연결할 수 없습니다. start.bat / start.sh를 먼저 실행하세요.`);

  const deck = JSON.parse(fs.readFileSync(deckPath, 'utf8'));
  const n = Array.isArray(deck.slides) ? deck.slides.length : 0;
  if (!n) throw new Error('덱에 slides가 없습니다');
  fs.writeFileSync(DECK_ABS, JSON.stringify(deck));
  fs.mkdirSync(outDir, { recursive: true });

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cardnews-chrome-'));
  const { proc, ws } = await launch(chrome, profile);
  const c = await cdp(ws);
  try {
    const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
    const s = (m, p) => c.send(m, p, sessionId);
    await s('Page.enable');
    await s('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1350, deviceScaleFactor: 1, mobile: false });
    for (let i = 1; i <= n; i++) {
      const url = `${SERVER}/?shoot=${i}&deck=${DECK_REL}&t=${Date.now()}${style ? `#${style}` : ''}`;
      await s('Page.navigate', { url });
      const t0 = Date.now();
      for (;;) {
        const r = await s('Runtime.evaluate', { expression: 'window.__SHOT_READY === true' });
        if (r.result && r.result.value) break;
        if (Date.now() - t0 > 30e3) throw new Error(`${i}번 카드 렌더 시간 초과`);
        await sleep(150);
      }
      const shot = await s('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1080, height: 1350, scale: 1 } });
      const file = path.join(outDir, `${String(i).padStart(2, '0')}.png`);
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      console.log(`✓ ${file}`);
    }
    console.log(`완료: ${n}장 → ${outDir}`);
  } finally {
    c.close();
    proc.kill();
    fs.rmSync(DECK_ABS, { force: true });
    setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500);
  }
})().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
