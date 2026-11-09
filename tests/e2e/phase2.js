const { launch, check, extId } = require('./harness');
(async () => {
  const { ctx, page } = await launch(`<html><body style="margin:0;font-family:sans-serif">
<div role="main" style="display:none">hidden view</div>
<div role="main"><div style="padding:12px;border-bottom:1px solid #ddd">[Gmail toolbar]</div>
<div style="padding:12px">[message list]</div></div></body></html>`);
  const errors = page.errors;
  const names = await page.$$eval('.natemail-tab', b => b.map(x => x.textContent));
  check(names.join('|') === 'Important|Calendar|Matt Levine|Customer support|Quo|Datadog|Other', 'tabs in order: ' + names.join(', '));
  check(await page.$eval('.natemail-tabs', b => b.parentElement.style.display !== 'none' && b.nextElementSibling.textContent === '[Gmail toolbar]'), 'bar sits above the toolbar in the visible main area');

  await page.click('[data-natemail-tab="datadog"]');
  const t = await page.waitForSelector('.natemail-toast:has-text("Datadog")');
  check(Boolean(t), 'empty split shows a toast, no navigation');
  check(page.url().endsWith('#inbox'), 'url unchanged on empty split');

  await page.click('[data-natemail-tab="important"]');
  await page.waitForFunction(() => location.hash.startsWith('#search/'));
  const q = await page.evaluate(() => decodeURIComponent(location.hash.slice(8)));
  check(q === 'in:inbox (is:important) -((filename:invite.ics) OR from:"calendar-notification@google.com")', 'Important search: ' + q);
  await page.waitForSelector('[data-natemail-tab="important"][aria-selected="true"]');
  check(true, 'Important tab highlighted');

  await page.keyboard.press('Tab');
  await page.waitForSelector('[data-natemail-tab="calendar"][aria-selected="true"]');
  check(true, 'Tab moves to Calendar (skips empty splits)');
  await page.keyboard.press('Tab');
  await page.waitForSelector('[data-natemail-tab="other"][aria-selected="true"]');
  check(true, 'Tab moves to Other');
  await page.keyboard.press('Shift+Tab');
  await page.waitForSelector('[data-natemail-tab="calendar"][aria-selected="true"]');
  check(true, 'Shift+Tab moves back');

  await page.evaluate(() => (location.hash = '#sent'));
  await page.waitForFunction(() => !document.querySelector('.natemail-tabs'));
  check(true, 'bar hidden on Sent');
  await page.evaluate(() => (location.hash = '#inbox/FMfcgzQabc'));
  await page.waitForSelector('.natemail-tabs');
  check(true, 'bar shown while a thread is open in the reading pane');

  // Options page: add a domain rule to Datadog and save.
  const opt = await ctx.newPage();
  await opt.goto(`chrome-extension://${extId}/options/options.html`);
  await opt.waitForSelector('.split');
  const dd = opt.locator('.split').nth(5);
  check((await dd.locator('.name').inputValue()) === 'Datadog', 'options shows Datadog 6th');
  await dd.getByText('+ Add rule').click();
  const dd2 = opt.locator('.split').nth(5);
  await dd2.locator('select').selectOption('domain');
  await dd2.locator('.value').fill('datadoghq.com');
  check((await dd2.locator('.preview').textContent()).includes('from:(@datadoghq.com)'), 'preview updates live');
  await opt.click('#save');
  await opt.waitForSelector('#status:has-text("Saved")');

  await page.bringToFront();
  await page.waitForSelector('[data-natemail-tab="datadog"]:not(.natemail-tab--empty)');
  check(true, 'Gmail tab bar picks up the saved rule without a reload');
  await page.click('[data-natemail-tab="datadog"]');
  await page.waitForFunction(() => location.hash.startsWith('#search/'));
  const q2 = await page.evaluate(() => decodeURIComponent(location.hash.slice(8)));
  check(q2 === 'in:inbox from:(@datadoghq.com) -((filename:invite.ics) OR from:"calendar-notification@google.com")', 'Datadog search: ' + q2);
  check(errors.length === 0, 'no page errors ' + errors.join('; '));
  await ctx.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
