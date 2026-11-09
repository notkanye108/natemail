// Arrow keys, Shift+P reading pane, Cmd+K palette.
const { launch, check } = require('./harness');
(async () => {
  const { ctx, page } = await launch();
  const closed = () => page.waitForFunction(() => !document.querySelector('.natemail-backdrop'));
  const cursor = () => page.$eval('tr.natemail-cursor .xT', x => x.textContent);
  await page.waitForSelector('tr.natemail-cursor');

  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  check(await cursor() === 'Subject 2', 'Down arrow moves like j');
  await page.keyboard.press('ArrowUp');
  check(await cursor() === 'Subject 1', 'Up arrow moves like k');
  check(!(await page.evaluate(() => gmailKeys)).some(k => k.startsWith('Arrow')), 'Gmail never sees the arrows');

  // Shift+P
  await page.keyboard.press('Shift+P');
  await page.waitForFunction(() => pane === 'none');
  check(true, 'Shift+P: vertical → no split');
  await page.keyboard.press('Shift+P');
  await page.waitForFunction(() => pane === 'vertical');
  check(true, 'Shift+P again: no split → vertical');

  // Cmd+K
  await page.keyboard.press('Meta+k');
  await page.waitForSelector('.natemail-palette');
  const names = await page.$$eval('.natemail-command span', s => s.map(x => x.textContent));
  check(names.includes('Remind me (snooze until a time)') && names.includes('Go to Calendar') && !names.includes('Go to Datadog'),
    'palette lists actions and splits with rules (' + names.length + ' commands)');
  await page.keyboard.type('go cal');
  check((await page.textContent('.natemail-option[aria-selected="true"]')) === 'Go to Calendar', 'words match in any order');
  await page.keyboard.press('Enter');
  await closed();
  await page.waitForSelector('[data-natemail-tab="calendar"][aria-selected="true"]');
  check(true, 'running "Go to Calendar" opens the Calendar tab');

  await page.evaluate(() => (location.hash = '#inbox'));
  await page.waitForTimeout(300);
  const before = await cursor();
  await page.keyboard.press('Control+k');
  await page.waitForSelector('.natemail-palette');
  check(true, 'Ctrl+K also opens it');
  await page.keyboard.type('archive');
  await page.keyboard.press('Enter');
  await closed();
  await page.waitForFunction(() => snoozed.length === 1);
  const arch = await page.evaluate(() => snoozed.join(' / '));
  check(arch === before + ' @ archived', "Archive clicks Gmail's Archive button for the cursor thread: " + arch);

  await page.waitForTimeout(200);
  await page.keyboard.press('Meta+k');
  await page.waitForSelector('.natemail-palette');
  await page.keyboard.type('remind');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.natemail-modal-title:has-text("Remind me")');
  check(true, 'palette can open Remind me');
  await page.keyboard.press('Escape');
  await closed();

  const optionsPage = ctx.waitForEvent('page');
  await page.keyboard.press('Meta+k');
  await page.waitForSelector('.natemail-palette');
  await page.keyboard.type('edit splits');
  await page.keyboard.press('Enter');
  const opt = await optionsPage;
  await opt.waitForLoadState();
  check(opt.url().endsWith('/options/options.html'), 'palette opens the options page');
  await page.bringToFront();

  await page.keyboard.press('Meta+k');
  await page.waitForSelector('.natemail-palette');
  await page.keyboard.type('zzzz');
  check((await page.$$('.natemail-command')).length === 0, 'no matches shows nothing');
  await page.keyboard.press('Enter');
  check(Boolean(await page.$('.natemail-palette')), 'Enter with no match does nothing');
  await page.keyboard.press('Escape');
  await closed();

  // Reading pane switched off in Gmail settings: clear message
  await page.evaluate(() => document.getElementById('splitbtn').remove());
  await page.keyboard.press('Shift+P');
  const t = await (await page.waitForSelector('.natemail-toast--error')).textContent();
  check(t.includes('Reading pane is on'), 'missing split-pane button explains what to check');

  check(page.errors.length === 0, 'no page errors ' + page.errors.join('; '));
  await ctx.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
