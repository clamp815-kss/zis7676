// HTML 애니메이션(window.render(t))을 프레임 단위로 캡처해 ffmpeg로 MP4(1080x1920, 30fps)를 만든다.
// 사용법:
//   node render.js <html> <music.wav> <out.mp4> <초>        전체 렌더
//   node render.js --stills <html> <outdir> 1 4 8 ...        지정 시각(초) 스틸 PNG 확인용
// 예:
//   node render.js reel.html galaxy_reel_music.wav galaxy_reel_30s.mp4 30
//   node render.js s25_ultra_reel.html s25_ultra_reel_music.wav s25_ultra_reel_50s.mp4 50
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const FPS = 30;

async function open(html) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(__dirname, html));
  await page.evaluate(() => window.ready);
  return { browser, page };
}

(async () => {
  const args = process.argv.slice(2);

  if (args[0] === '--stills') {
    const [, html, dir, ...times] = args;
    const { browser, page } = await open(html);
    fs.mkdirSync(dir, { recursive: true });
    for (const s of times) {
      await page.evaluate(t => window.render(t), parseFloat(s));
      await page.screenshot({ path: path.join(dir, `t${s}.png`) });
    }
    await browser.close();
    return;
  }

  const [html, wav, out, durArg] = args;
  const DUR = parseFloat(durArg);
  if (!html || !wav || !out || !(DUR > 0)) {
    console.error('usage: node render.js <html> <music.wav> <out.mp4> <seconds>');
    process.exit(1);
  }
  const { browser, page } = await open(html);
  const ff = spawn('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', wav,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k',
    '-t', String(DUR), '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const total = Math.round(FPS * DUR);
  for (let i = 0; i < total; i++) {
    await page.evaluate(t => window.render(t), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) process.stdout.write(`frame ${i}/${total}\n`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('done', out);
})();
