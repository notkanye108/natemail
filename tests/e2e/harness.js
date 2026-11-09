// Shared setup for the browser checks: loads natemail into Chromium and
// serves a fake Gmail page (fakegmail.js) instead of the real one.
const { chromium } = require('playwright');
const crypto = require('crypto');
const fakeGmail = require('./fakegmail');
const ext = require('path').resolve(__dirname, '../..');
exports.extId = crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32).split('').map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');
exports.check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) process.exitCode = 1; };
exports.launch = async (html) => {
  const ctx = await chromium.launchPersistentContext('', { headless: true, channel: 'chromium', ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), viewport: { width: 1000, height: 520 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  await ctx.route('https://mail.google.com/**', r => r.fulfill({ contentType: 'text/html', body: html || fakeGmail() }));
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', e => page.errors.push(e.message));
  await page.goto('https://mail.google.com/mail/u/0/#inbox');
  await page.waitForSelector('.natemail-tabs');
  return { ctx, page };
};
