const { launch, check } = require('./harness');
(async () => {
  const { ctx, page } = await launch();
  const state = () => page.$$eval('tr.zA', rs => rs.map(r => (r.classList.contains('natemail-cursor') ? '>' : ' ') + (r.querySelector('.cb').getAttribute('aria-checked') === 'true' ? 'x' : '.') + r.querySelector('.xT').textContent.slice(-1)).join(' '));
  await page.waitForSelector('tr.natemail-cursor');
  check(await state() === '>x0  .1  .2  .3  .4  .5', 'first thread has cursor and is selected on load: ' + await state());
  await page.keyboard.press('j'); await page.keyboard.press('j');
  check(await state() === ' .0  .1 >x2  .3  .4  .5', 'j j moves cursor; only cursor row selected: ' + await state());
  await page.keyboard.press('k');
  check(await state() === ' .0 >x1  .2  .3  .4  .5', 'k moves back: ' + await state());
  check(!(await page.evaluate(() => gmailKeys)).some(k => k === 'j' || k === 'k'), 'Gmail never sees j/k');

  await page.keyboard.press('e');
  await page.waitForFunction(() => document.querySelectorAll('tr.zA').length === 5);
  await page.waitForTimeout(200);
  check(await state() === ' .0 >x2  .3  .4  .5', 'e archives cursor thread; next one is selected: ' + await state());
  check((await page.evaluate(() => gmailKeys)).includes('e'), "Gmail's own e did the archiving");

  // multi-select: s on 2, move to 4, s, then e archives 2,3?(no) -> 2 and 4 kept + cursor 4
  await page.keyboard.press('s');
  await page.keyboard.press('j'); await page.keyboard.press('j');
  check(await state() === ' .0 >x2  .3  .4  .5'.replace('>x2', ' x2').replace(' .4', '>x4'), 's keeps 2 selected while moving to 4: ' + await state());
  await page.keyboard.press('Escape');
  check(await state() === ' .0  .2  .3 >x4  .5', 'Esc clears the kept selection: ' + await state());
  await page.keyboard.press('k'); await page.keyboard.press('s'); await page.keyboard.press('j'); await page.keyboard.press('s');
  await page.keyboard.press('e');
  await page.waitForFunction(() => document.querySelectorAll('tr.zA').length === 3);
  await page.waitForTimeout(200);
  check(await state() === ' .0  .2 >x5', 'e archives both selected threads; cursor lands on next: ' + await state());

  await page.keyboard.press('k');
  await page.keyboard.press('Enter');
  await page.waitForSelector('h2.hP');
  check(await page.$eval('h2.hP', h => h.textContent) === 'Subject 2', 'Enter opens the cursor thread in the reading pane');
  check(await state() === ' .0 >x2  .5', 'opening a thread keeps the cursor: ' + await state());
  await page.keyboard.press('j');
  check(await state() === ' .0  .2 >x5', 'j still works with the reading pane open: ' + await state());

  await page.keyboard.press('?');
  await page.waitForSelector('.natemail-help');
  const help = await page.$eval('.natemail-help', h => h.textContent);
  check(help.includes('Next thread') && help.includes('Archive'), '? shows the shortcut list');
  await page.keyboard.press('j');
  check(await state() === ' .0  .2 >x5', 'keys are paused while help is open');
  await page.keyboard.press('Tab');
  check(page.url().includes('#inbox'), 'Tab does not switch splits while help is open');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.natemail-backdrop'));
  check(true, 'Esc closes help');
  await page.keyboard.press('k');
  check(await state() === ' .0 >x2  .5', 'keys work again after closing help');

  // typing in a text box is left alone
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'box'; document.body.append(i); });
  await page.focus('#box'); await page.keyboard.type('jjkse');
  const st = await state(); check(await page.$eval('#box', i => i.value) === 'jjkse' && st === ' .0 >x2  .5', 'typing in a text box never triggers shortcuts: ' + st + ' box=' + await page.$eval('#box', i => i.value));
  check(page.errors.length === 0, 'no page errors ' + page.errors.join('; '));
  await ctx.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
