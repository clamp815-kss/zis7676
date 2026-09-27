#!/usr/bin/env node
// 실행파일 빌드 — Node.js 공식 SEA(Single Executable Application)
// 사용: node tools/build-exe.js [대상...]     대상: win-x64(기본), linux-x64, darwin-arm64, darwin-x64
// 결과: dist/cardnews-<대상>.exe (또는 확장자 없음) — Node 런타임 + 서버 + 에디터 파일 전체 내장
// 필요: 빌드 PC의 Node 22+, 인터넷(대상 플랫폼 node 바이너리 다운로드, npx postject)
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const DIST = path.join(ROOT, 'dist');
const CACHE = path.join(BUILD, 'node-cache');
const NODE_VER = process.version; // SEA blob은 같은 버전의 node 바이너리에만 주입 가능
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const POSTJECT = 'postject@1.0.0-alpha.6';

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['win-x64'];
const VALID = ['win-x64', 'win-arm64', 'linux-x64', 'linux-arm64', 'darwin-x64', 'darwin-arm64'];
for (const t of targets) if (!VALID.includes(t)) { console.error(`알 수 없는 대상: ${t} (${VALID.join(', ')})`); process.exit(1); }

// ───────── 1. 내장할 파일 목록 ─────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const files = [
  ...walk(path.join(ROOT, 'editor')).filter((p) => {
    const r = rel(p);
    // 생성 이미지·렌더 임시파일·버전 마커는 제외 (gen 폴더는 .gitkeep만)
    return !(r.startsWith('editor/assets/gen/') && !r.endsWith('.gitkeep')) && !r.endsWith('.bundle-version');
  }),
  path.join(ROOT, 'tools', 'deck-prompt.md'),
  ...fs.readdirSync(path.join(ROOT, 'tools')).filter((f) => f.endsWith('.example')).map((f) => path.join(ROOT, 'tools', f)),
  path.join(ROOT, 'README.md'),
].map(rel).sort();

const hash = crypto.createHash('sha256');
for (const f of files) hash.update(f).update(fs.readFileSync(path.join(ROOT, f)));
hash.update(fs.readFileSync(path.join(ROOT, 'server.js')));
const version = hash.digest('hex').slice(0, 12);

// ───────── 2. SEA blob 생성 ─────────
fs.rmSync(path.join(BUILD, 'sea'), { recursive: true, force: true });
fs.mkdirSync(path.join(BUILD, 'sea'), { recursive: true });
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(BUILD, 'sea', 'manifest.json'), JSON.stringify({ version, files }));
const config = {
  main: path.join(ROOT, 'server.js'),
  output: path.join(BUILD, 'sea', 'sea-prep.blob'),
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false, // 크로스 플랫폼 빌드를 위해 끔
  assets: Object.fromEntries([['manifest.json', path.join(BUILD, 'sea', 'manifest.json')], ...files.map((f) => [f, path.join(ROOT, f)])]),
};
fs.writeFileSync(path.join(BUILD, 'sea', 'sea-config.json'), JSON.stringify(config, null, 2));
console.log(`■ 내장 파일 ${files.length}개, 번들 버전 ${version}, Node ${NODE_VER}`);
execFileSync(process.execPath, ['--experimental-sea-config', path.join(BUILD, 'sea', 'sea-config.json')], { stdio: 'inherit' });

// ───────── 3. 대상별 node 바이너리 준비 ─────────
async function download(url, dest) {
  console.log(`  ↓ ${url}`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`다운로드 실패 ${r.status}: ${url}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

async function nodeBinary(target) {
  const [plat, arch] = target.split('-');
  if (plat === (process.platform === 'win32' ? 'win' : process.platform) && arch === process.arch) return process.execPath;
  const dir = path.join(CACHE, `${NODE_VER}-${target}`);
  const bin = path.join(dir, plat === 'win' ? 'node.exe' : 'node');
  if (fs.existsSync(bin)) return bin;
  const base = `https://nodejs.org/dist/${NODE_VER}`;
  if (plat === 'win') { await download(`${base}/win-${arch}/node.exe`, bin); return bin; }
  const name = `node-${NODE_VER}-${target}`;
  const tgz = path.join(dir, `${name}.tar.gz`);
  await download(`${base}/${name}.tar.gz`, tgz);
  execFileSync('tar', ['-xzf', tgz, '-C', dir, `${name}/bin/node`]);
  fs.renameSync(path.join(dir, name, 'bin', 'node'), bin);
  fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  fs.rmSync(tgz, { force: true });
  return bin;
}

// ───────── 4. 주입 ─────────
(async () => {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  for (const target of targets) {
    const plat = target.split('-')[0];
    const out = path.join(DIST, `cardnews-${target}${plat === 'win' ? '.exe' : ''}`);
    console.log(`■ ${target}`);
    fs.copyFileSync(await nodeBinary(target), out);
    fs.chmodSync(out, 0o755);
    if (plat === 'darwin' && process.platform === 'darwin') execFileSync('codesign', ['--remove-signature', out]);
    const args = ['--yes', POSTJECT, out, 'NODE_SEA_BLOB', config.output, '--sentinel-fuse', FUSE];
    if (plat === 'darwin') args.push('--macho-segment-name', 'NODE_SEA');
    execFileSync(npx, args, { stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' });
    if (plat === 'darwin') {
      if (process.platform === 'darwin') execFileSync('codesign', ['--sign', '-', out]);
      else console.log('  ⚠ macOS 실행파일은 macOS에서 `codesign --sign - <파일>` 서명이 필요합니다');
    }
    console.log(`  ✓ ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1048576).toFixed(1)}MB)`);
  }
})().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
