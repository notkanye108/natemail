// Always-in-select cursor, picking with s, mouse clicks, help screen.
const { launch, check } = require('./harness');
(async () => {
  const { ctx, page } = await launch();
  // Each row: ">" = cursor, "x" = ticked in Gmail, "." = not ticked, then its number.
  const state = () => page.$$eval('tr.zA', rs => rs.map(r => (r.classList.contains('natemail-cursor') ? '>' : ' ') + (r.querySelector('.cb').getAttribute('aria-checked') === 'true' ? 'x' : '.') + r.querySelector('.xT').textContent.slice(-1)).join(' '));
  const settle = () => page.waitForTimeout(350);
  const expect = async (want, msg) => { await settle(); const got = await state(); check(got === want, `${msg}: ${got}`); };

  await page.waitForSelector('tr.natemail-cursor');
  await expect('>x0  .1  .2  .3  .4  .5', 'first thread has the cursor and is ticked');
  await page.keyboard.press('j'); await page.keyboard.press('j');
  await expect(' .0  .1 >x2  .3  .4  .5', 'j j: only the cursor thread is ticked');
  await page.keyboard.press('k');
  await expect(' .0 >x1  .2  .3  .4  .5', 'k moves back');
  check(!(await page.evaluate(() => gmailKeys)).some(k => k === 'j' || k === 'k'), 'Gmail never sees j/k');

  await page.keyboard.press('e');
  await expect(' .0 >x2  .3  .4  .5', 'e archives; next thread is ticked even after Gmail clears checkboxes');
  await page.keyboard.press('e');
  await expect(' .0 >x3  .4  .5', 'e again works straight away, no s needed');

  // Picking
  await page.keyboard.press('s');
  await expect(' .0 >x3  .4  .5', 's picks the cursor thread');
  await page.keyboard.press('j');
  await expect(' .0  x3 >.4  .5', 'with a pick, moving does not tick the new cursor thread');
  await page.keyboard.press('s');
  await expect(' .0  x3 >x4  .5', 's picks a second thread');
  await page.keyboard.press('s');
  await expect(' .0  x3 >.4  .5', 's again unpicks it');
  await page.keyboard.press('s');
  await page.keyboard.press('e');
  await expect(' .0 >x5', 'e archives both picked threads; back to cursor mode');

  await page.keyboard.press('k'); await page.keyboard.press('s'); await page.keyboard.press('j'); await page.keyboard.press('s');
  await expect(' x0 >x5', 'picked two');
  await page.keyboard.press('Escape');
  await expect(' .0 >x5', 'Esc unpicks all; cursor thread ticked again');

  // Mouse
  await page.click('tr.zA:nth-child(1) .xT');
  await expect('>x0  .5', 'clicking a thread moves the cursor to it');
  check(await page.$eval('h2.hP', h => h.textContent) === 'Subject 0', 'and Gmail opens it');
  await page.keyboard.press('j');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('h2.hP').textContent === 'Subject 5');
  check(true, 'Enter opens the cursor thread, not an old one');
  await page.click('tr.zA:nth-child(1) .cb');
  await expect(' x0 >x5', 'ticking another checkbox by hand picks it alongside the cursor thread');
  await page.click('tr.zA:nth-child(1) .cb');
  await expect(' .0 >x5', 'unticking it by hand unpicks it');

  // Help screen
  await page.keyboard.press('?');
  await page.waitForSelector('.natemail-help');
  const help = await page.$eval('.natemail-help', h => h.textContent);
  check(help.includes('Next thread') && help.includes('Archive'), '? shows the shortcut list');
  await page.keyboard.press('k');
  await expect(' .0 >x5', 'keys are paused while help is open');
  await page.keyboard.press('Tab');
  check(page.url().includes('#inbox'), 'Tab does not switch splits while help is open');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.natemail-backdrop'));
  await page.keyboard.press('k');
  await expect('>x0  .5', 'keys work again after closing help');

  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'box'; document.body.append(i); });
  await page.focus('#box'); await page.keyboard.type('jjkse');
  await expect('>x0  .5', 'typing in a text box never triggers shortcuts');
  check(page.errors.length === 0, 'no page errors ' + page.errors.join('; '));
  await ctx.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
