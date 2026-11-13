// Browser smoke tests. Every check runs against each HTML file listed in PAGES,
// so both versions of the game stay working until one is chosen as canonical.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, devices } = require('playwright');

const PAGES = ['index.html', 'tetris_palace_v13_audio_ui_fix.html'];
const HIGH_SCORE_KEY = 'tetris-palace-high-score-v2';

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function open(file, contextOptions = {}) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  await page.goto(pathToFileURL(path.join(__dirname, '..', file)).href);
  return { context, page, errors };
}

const isHidden = (page, selector) =>
  page.locator(selector).evaluate((el) => el.classList.contains('hidden'));

async function waitForText(page, selector, expected) {
  await page.waitForFunction(
    ([sel, text]) => document.querySelector(sel)?.textContent.trim() === text,
    [selector, expected],
    { timeout: 5000 },
  );
}

for (const file of PAGES) {
  describe(file, () => {
    test('loads with the menu open and no script errors', async () => {
      const { context, page, errors } = await open(file);
      try {
        assert.equal(await isHidden(page, '#menuOverlay'), false);
        assert.equal(await isHidden(page, '#resultOverlay'), true);
        assert.equal((await page.textContent('#highScoreValue')).trim(), '0000000');
        await page.waitForTimeout(500); // let a few animation frames run
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    });

    test('1P game starts, a hard drop scores, and no errors occur', async () => {
      const { context, page, errors } = await open(file);
      try {
        await page.click('[data-mode="1"]');
        assert.equal(await isHidden(page, '#menuOverlay'), true);
        assert.equal(await isHidden(page, '#player2Card'), true);
        await waitForText(page, '#statusP1', 'PLAYING');

        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('Space');
        await page.waitForFunction(
          () => Number(document.querySelector('#scoreP1').textContent.replace(/\D/g, '')) > 0,
          null,
          { timeout: 5000 },
        );
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    });

    test('pause toggles with the P key and the pause button', async () => {
      const { context, page } = await open(file);
      try {
        await page.click('[data-mode="1"]');
        await waitForText(page, '#statusP1', 'PLAYING');
        await page.keyboard.press('p');
        await waitForText(page, '#statusP1', 'PAUSED');
        await page.click('#pauseBtn');
        await waitForText(page, '#statusP1', 'PLAYING');
      } finally {
        await context.close();
      }
    });

    test('menu button returns to the menu', async () => {
      const { context, page } = await open(file);
      try {
        await page.click('[data-mode="1"]');
        await waitForText(page, '#statusP1', 'PLAYING');
        await page.click('#menuBtn');
        assert.equal(await isHidden(page, '#menuOverlay'), false);
      } finally {
        await context.close();
      }
    });

    test('2P game shows both boards and each player has own keys', async () => {
      const { context, page, errors } = await open(file);
      try {
        await page.click('[data-mode="2"]');
        assert.equal(await isHidden(page, '#player2Card'), false);
        await waitForText(page, '#statusP2', 'PLAYING');
        await page.keyboard.press('ShiftLeft'); // P2 hard drop
        await page.waitForFunction(
          () => Number(document.querySelector('#scoreP2').textContent.replace(/\D/g, '')) > 0,
          null,
          { timeout: 5000 },
        );
        assert.equal(
          Number((await page.textContent('#scoreP1')).replace(/\D/g, '')),
          0,
          'P2 key must not score for P1',
        );
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    });

    test('saved high score is shown after reload', async () => {
      const { context, page } = await open(file);
      try {
        await page.evaluate((key) => localStorage.setItem(key, '4321'), HIGH_SCORE_KEY);
        await page.reload();
        assert.equal((await page.textContent('#highScoreValue')).trim(), '0004321');
      } finally {
        await context.close();
      }
    });

    for (const deviceName of ['iPhone 13', 'Pixel 7', 'iPad Mini']) {
      test(`${deviceName}: fits the screen and starts by tap`, async () => {
        const { defaultBrowserType, ...device } = devices[deviceName];
        const { context, page, errors } = await open(file, device);
        try {
          await page.tap('[data-mode="1"]');
          await waitForText(page, '#statusP1', 'PLAYING');
          await page.waitForTimeout(300); // responsive sizing settles

          const layout = await page.evaluate(() => {
            const board = document.querySelector('#board1').getBoundingClientRect();
            return {
              scrollWidth: document.documentElement.scrollWidth,
              viewportWidth: window.innerWidth,
              viewportHeight: window.innerHeight,
              board: { left: board.left, right: board.right, top: board.top, bottom: board.bottom, width: board.width },
            };
          });
          assert.ok(layout.scrollWidth <= layout.viewportWidth + 1, 'no horizontal overflow');
          assert.ok(layout.board.width > 0, 'board is rendered');
          assert.ok(layout.board.left >= -1 && layout.board.right <= layout.viewportWidth + 1, 'board fits horizontally');
          assert.ok(layout.board.top >= -1 && layout.board.bottom <= layout.viewportHeight + 1, 'board fits vertically');
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      });
    }
  });
}
