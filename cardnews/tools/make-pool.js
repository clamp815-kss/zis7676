#!/usr/bin/env node
// 스타일별 기본 배경 풀 + 픽셀 마스코트 생성기 (의존성 0, 순수 Node PNG 인코더)
// 사용: node tools/make-pool.js   → editor/assets/pool/{cine,mag,manga}/NN.png, editor/assets/mascot.png
// ⚠️ 절차적(추상) 배경입니다. 실제 사진/AI 생성 이미지로 교체하려면 같은 파일명으로 덮어쓰세요.
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'editor', 'assets');
const W = 720, H = 900; // 4:5, cover로 확대 표시

// ───────── PNG 인코더 ─────────
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, px, channels) {
  const stride = w * channels;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 1; // Sub 필터 — 그라데이션 압축에 유리
    for (let x = 0; x < stride; x++) {
      const cur = px[y * stride + x];
      const left = x >= channels ? px[y * stride + x - channels] : 0;
      raw[y * (stride + 1) + 1 + x] = (cur - left) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ───────── 도우미 ─────────
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [0, 1, 2].map((i) => lerp(c1[i], c2[i], t));
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const smooth = (t) => t * t * (3 - 2 * t);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);

function render(shade) {
  const px = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = shade(x / W, y / H, x, y);
      const d = BAYER[(y & 3) * 4 + (x & 3)] * 1.6; // 디더링: 어두운 그라데이션 밴딩 방지
      const i = (y * W + x) * 3;
      px[i] = clamp(Math.round(c[0] + d));
      px[i + 1] = clamp(Math.round(c[1] + d));
      px[i + 2] = clamp(Math.round(c[2] + d));
    }
  }
  return encodePNG(W, H, px, 3);
}

function vertical(stops, t) {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
      return mix(c0, c1, smooth((t - t0) / (t1 - t0)));
    }
  }
  return stops[stops.length - 1][1];
}

// 부드러운 원(빛 번짐/보케)
function glow(c, u, v, blobs) {
  let out = c;
  for (const b of blobs) {
    const dx = (u - b.x) / b.r, dy = ((v - b.y) * 1.25) / b.r;
    const d = dx * dx + dy * dy;
    if (d < 1) {
      const a = b.a * Math.pow(1 - d, b.p || 2);
      out = b.add ? out.map((ch, i) => ch + b.c[i] * a) : mix(out, b.c, a);
    }
  }
  return out;
}

// ───────── 시네마틱: 어두운 도시·새벽·네온 ─────────
const CINE = [
  ['#050b1a', '#0d2a52', '#1b4f8a', '#02050d'],
  ['#07070d', '#1a1033', '#4a2360', '#050308'],
  ['#020b10', '#0a3440', '#1f6f7a', '#010406'],
  ['#0a0a0a', '#2a1a0e', '#8a4a1c', '#050302'],
  ['#050a14', '#16233f', '#6b7fa8', '#03060c'],
  ['#08060f', '#231433', '#1b3a6b', '#020308'],
  ['#060c0a', '#113026', '#2c6b52', '#020504'],
  ['#0b0710', '#3b1426', '#a13a4a', '#050206'],
  ['#03060d', '#0e1f3d', '#2d5fb3', '#010205'],
];
function cine(i) {
  const [top, mid, hi, bot] = CINE[i].map(hex);
  const r = rng(1000 + i * 77);
  const horizon = 0.45 + r() * 0.2;
  const blobs = [];
  blobs.push({ x: 0.2 + r() * 0.6, y: horizon - 0.05, r: 0.55 + r() * 0.3, c: hi, a: 0.55, p: 2.4 });
  for (let k = 0; k < 18; k++) {
    blobs.push({ x: r(), y: horizon - 0.25 + r() * 0.35, r: 0.015 + r() * 0.05, c: mix(hi, [255, 240, 220], r() * 0.6), a: 0.15 + r() * 0.35, p: 1.5, add: true });
  }
  // 도시 스카이라인 실루엣
  const bars = [];
  let x = 0;
  while (x < 1) { const w = 0.03 + r() * 0.07; bars.push({ x0: x, x1: x + w, h: 0.05 + r() * 0.22 }); x += w + r() * 0.01; }
  return render((u, v) => {
    let c = vertical([[0, top], [horizon, mid], [horizon + 0.12, hi.map((h, k) => lerp(h, mid[k], 0.5))], [1, bot]], v);
    c = glow(c, u, v, blobs);
    const b = bars.find((q) => u >= q.x0 && u < q.x1);
    if (b && v > horizon + 0.12 - b.h && v < horizon + 0.2) c = mix(c, bot, 0.85);
    if (v >= horizon + 0.2) c = mix(c, bot, 0.6 + (v - horizon) * 0.4);
    const vig = Math.pow(Math.hypot(u - 0.5, v - 0.5) / 0.75, 2.2);
    return mix(c, [0, 0, 0], Math.min(vig, 0.85));
  });
}

// ───────── 매거진: 밝은 에디토리얼 그라데이션 + 큰 도형 ─────────
const MAG = [
  ['#f6d365', '#fda085', '#2b2b2b'],
  ['#a1c4fd', '#c2e9fb', '#1d3557'],
  ['#fbc2eb', '#a6c1ee', '#2d2240'],
  ['#d4fc79', '#96e6a1', '#1f3b2c'],
  ['#ffecd2', '#fcb69f', '#3b2a22'],
  ['#e0c3fc', '#8ec5fc', '#1f2a44'],
];
function mag(i) {
  const [a, b, dark] = MAG[i].map(hex);
  const r = rng(2000 + i * 131);
  const blobs = [
    { x: r(), y: 0.2 + r() * 0.3, r: 0.5 + r() * 0.2, c: [255, 255, 255], a: 0.5, p: 3 },
    { x: r(), y: 0.35 + r() * 0.2, r: 0.35 + r() * 0.2, c: mix(a, dark, 0.35), a: 0.6, p: 1.2 },
  ];
  const ang = r() * Math.PI;
  return render((u, v) => {
    const t = 0.5 + ((u - 0.5) * Math.cos(ang) + (v - 0.5) * Math.sin(ang)) * 0.9;
    let c = mix(a, b, smooth(Math.max(0, Math.min(1, t))));
    c = glow(c, u, v, blobs);
    // 하단은 텍스트 가독성을 위해 어둡게
    return mix(c, dark, smooth(Math.max(0, (v - 0.55) / 0.45)) * 0.85);
  });
}

// ───────── 만화: 집중선 + 망점 ─────────
const MANGA = [
  ['#f5f1e8', '#1a1a1a', '#e63946'],
  ['#eef3f8', '#15202b', '#1d8fe0'],
  ['#fff6e0', '#231a10', '#f4a300'],
  ['#f2eef7', '#1c1426', '#9b5de5'],
  ['#eaf6ef', '#10201a', '#2a9d8f'],
  ['#fbeef0', '#24121a', '#ef476f'],
];
function manga(i) {
  const [paper, ink, tone] = MANGA[i].map(hex);
  const r = rng(3000 + i * 57);
  const cx = 0.3 + r() * 0.4, cy = 0.25 + r() * 0.2;
  const rays = 90 + Math.floor(r() * 60);
  const jitter = Array.from({ length: rays }, () => 0.35 + r() * 0.6);
  return render((u, v, x, y) => {
    const dx = u - cx, dy = (v - cy) * 1.25;
    const dist = Math.hypot(dx, dy);
    const a = (Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1;
    const k = Math.floor(a * rays);
    const f = (a * rays) % 1;
    let c = mix(paper, tone, 0.18);
    // 집중선: 중심에서 멀수록 두꺼움
    const start = jitter[k] * 0.45;
    if (dist > start && k % 2 === 0 && Math.abs(f - 0.5) < 0.12 + dist * 0.25) c = mix(c, ink, Math.min(1, (dist - start) * 3));
    // 망점: 하단으로 갈수록 커짐
    const cell = 12, gx = (x % cell) - cell / 2, gy = (y % cell) - cell / 2;
    const rad = cell * 0.5 * smooth(Math.max(0, (v - 0.45) / 0.55));
    if (gx * gx + gy * gy < rad * rad) c = mix(c, ink, 0.9);
    return c;
  });
}

// ───────── 픽셀 마스코트 (16×16 → 256px RGBA) ─────────
function mascot() {
  const art = [
    '......KKKK......',
    '.......KK.......',
    '....KKKKKKKK....',
    '...KOOOOOOOOK...',
    '..KOOOOOOOOOOK..',
    '..KOWWKOOWWKOK..',
    '..KOWKKOOWKKOK..',
    '..KOOOOOOOOOOK..',
    '..KOOPOOOOPOOK..',
    '..KOOOKKKKOOOK..',
    '...KOOOOOOOOK...',
    '....KKKKKKKK....',
    '...KYYYYYYYYK...',
    '..KYKYYYYYYKYK..',
    '..KK.KYYYYK.KK..',
    '.....KK..KK.....',
  ];
  const pal = { K: [17, 17, 17, 255], O: [255, 138, 34, 255], W: [255, 255, 255, 255], P: [255, 170, 190, 255], Y: [255, 210, 63, 255], '.': [0, 0, 0, 0] };
  const S = 16, N = 16 * S;
  const px = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) px.set(pal[art[(y / S) | 0][(x / S) | 0]], (y * N + x) * 4);
  return encodePNG(N, N, px, 4);
}

// ───────── 실행 ─────────
const jobs = [['cine', 9, cine], ['mag', 6, mag], ['manga', 6, manga]];
for (const [name, n, fn] of jobs) {
  const dir = path.join(OUT, 'pool', name);
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < n; i++) {
    const file = path.join(dir, `${String(i + 1).padStart(2, '0')}.png`);
    fs.writeFileSync(file, fn(i));
    console.log(`${path.relative(OUT, file)}  ${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
  }
}
fs.writeFileSync(path.join(OUT, 'mascot.png'), mascot());
console.log('mascot.png');
