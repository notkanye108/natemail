// Remind me (h): presets, typed times, multiple threads, errors.
const { launch, check } = require('./harness');
(async () => {
  const { ctx, page } = await launch();
  const closed = () => page.waitForFunction(() => !document.querySelector('.natemail-backdrop'));
  const toast = async (text) => (await page.waitForSelector(`.natemail-toast:has-text("${text}")`, { timeout: 5000 })).textContent();
  const snoozed = () => page.evaluate(() => snoozed.slice());
  await page.waitForSelector('tr.natemail-cursor');

  // Preset
  await page.keyboard.press('h');
  await page.waitForSelector('.natemail-modal-title:has-text("Remind me")');
  check((await page.textContent('.natemail-options')) === 'Later todayTomorrowThis weekendNext week', 'presets listed');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await closed();
  check((await toast('Snoozed')) === 'Snoozed: tomorrow', 'toast confirms preset');
  check((await snoozed()).length === 1 && (await snoozed())[0].startsWith('Subject 0 @ Tomorrow'), "clicked Gmail's own Tomorrow for the cursor thread: " + await snoozed());
  await page.waitForTimeout(300);
  check(await page.$eval('tr.natemail-cursor .xT', x => x.textContent) === 'Subject 1', 'cursor moves to the next thread');

  // Typed time
  await page.keyboard.press('h');
  await page.waitForSelector('.natemail-modal');
  await page.keyboard.type('nov 20 10am');
  const preview = await page.textContent('.natemail-note');
  check(/Nov 20, 10:00/.test(preview), 'preview shows the parsed time: ' + preview);
  await page.keyboard.press('Enter');
  await closed();
  check((await toast('Snoozed until')).includes('Nov 20'), 'toast confirms typed time');
  const s2 = (await snoozed())[1] || '';
  check(/^Subject 1 @ Nov 20, 20\d\d 10:00 AM$/.test(s2), "filled Gmail's date & time box: " + s2);

  // Nonsense
  await page.keyboard.press('h');
  await page.waitForSelector('.natemail-modal');
  await page.keyboard.type('whenever');
  check((await page.textContent('.natemail-note')).startsWith('Not sure when'), 'unparseable text shows a hint');
  await page.keyboard.press('Enter');
  check(Boolean(await page.$('.natemail-modal')), 'Enter does nothing on unparseable text');
  await page.keyboard.press('Escape');
  await closed();

  // Multiple picked threads
  await page.keyboard.press('s'); await page.keyboard.press('j'); await page.keyboard.press('s');
  await page.waitForTimeout(200);
  await page.keyboard.press('h');
  await page.waitForSelector('.natemail-modal-title:has-text("2 threads")');
  check(true, 'title says 2 threads');
  await page.keyboard.type('3d');
  await page.keyboard.press('Enter');
  await closed();
  await toast('Snoozed until');
  const s3 = (await snoozed()).slice(2);
  check(s3.length === 2 && s3[0].startsWith('Subject 2') && s3[1].startsWith('Subject 3'), 'both picked threads snoozed: ' + s3);

  // Gmail layout changed: no Snooze button
  await page.evaluate(() => document.getElementById('snooze').remove());
  await page.keyboard.press('h');
  await page.waitForSelector('.natemail-modal');
  await page.keyboard.press('Enter');
  await closed();
  const err = await toast("Couldn't snooze");
  check(err.includes("finding Gmail's Snooze button"), 'clear error naming the failed step: ' + err);
  check(await page.$eval('.natemail-toast--error', () => true).catch(() => false), 'error toast is red');

  check(page.errors.length === 0, 'no page errors ' + page.errors.join('; '));
  await ctx.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
