const { launch, check } = require('./harness');
(async () => {
  const { ctx, page } = await launch();
  const toast = async (text) => (await page.waitForSelector(`.natemail-toast:has-text("${text}")`, { timeout: 5000 })).textContent();
  const closed = () => page.waitForFunction(() => !document.querySelector('.natemail-backdrop'));
  await page.waitForSelector('tr.natemail-cursor');

  // 1. Datadog row: anyone at the domain, into Datadog
  await page.keyboard.press('Shift+S');
  await page.waitForSelector('.natemail-sort-who');
  check((await page.textContent('.natemail-sort-who')).startsWith('alerts@datadoghq.com'), 'picker shows the cursor thread sender');
  await page.keyboard.press('2');
  check(await page.inputValue('.natemail-input') === '', 'pressing 2 picks a mode, does not type');
  await page.keyboard.type('data');
  await page.keyboard.press('Enter');
  await closed();
  check((await toast('Datadog now')) === 'Datadog now includes anyone at @datadoghq.com', 'toast confirms the rule');
  await page.waitForSelector('[data-natemail-tab="datadog"]:not(.natemail-tab--empty)');
  check(true, 'Datadog tab is no longer empty');

  // 2. Support row: any thread involving help@pylon.example
  await page.keyboard.press('j'); await page.keyboard.press('j'); // row index 2 (Support, CEO)
  await page.keyboard.press('Shift+S');
  await page.waitForSelector('.natemail-sort-who');
  check((await page.textContent('.natemail-sort-who')).includes('Tab: next address (1 of 2)'), 'Tab hint when the thread has 2 people');
  await page.keyboard.press('Tab');
  check((await page.textContent('.natemail-sort-who')).startsWith('ceo@customer.com'), 'Tab switches to the other address');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('3');
  await page.keyboard.type('supp');
  await page.keyboard.press('Enter');
  await closed();
  check((await toast('Customer support now')) === 'Customer support now includes any thread with help@pylon.example', 'support rule uses "any thread with"');

  // 3. Move Datadog's domain into Quo
  await page.keyboard.press('k'); await page.keyboard.press('k');
  await page.keyboard.press('Shift+S');
  await page.waitForSelector('.natemail-sort-who');
  await page.keyboard.press('2');
  await page.keyboard.type('quo');
  await page.waitForSelector('.natemail-note:has-text("Currently in Datadog")');
  check(true, 'picker warns the sender is already in Datadog');
  await page.keyboard.press('Enter');
  await closed();
  check((await toast('Quo now')) === 'Quo now includes anyone at @datadoghq.com (moved from Datadog)', 'moving reports where it came from');
  await page.waitForSelector('[data-natemail-tab="datadog"].natemail-tab--empty');
  check(true, 'Datadog tab is empty again');

  // 4. gmail.com sender: domain option is off; create a new split from the picker
  for (let i = 0; i < 5; i++) await page.keyboard.press('j');
  await page.keyboard.press('Shift+S');
  await page.waitForSelector('.natemail-sort-who');
  check((await page.textContent('.natemail-sort-who')).startsWith('friend@gmail.com'), 'last row is the gmail.com friend');
  check(await page.$eval('.natemail-mode:nth-child(2)', b => b.disabled), '"Anyone at @gmail.com" is turned off');
  await page.keyboard.type('Friends');
  check((await page.textContent('.natemail-options')).includes('Create “Friends”'), 'offers to create a new split');
  await page.keyboard.press('Enter');
  await closed();
  check((await toast('Friends now')) === 'Friends now includes friend@gmail.com', 'new split created with the sender in it');
  const names = await page.$$eval('.natemail-tab', b => b.map(x => x.textContent));
  check(names.join('|') === 'Important|Calendar|Matt Levine|Customer support|Quo|Datadog|Friends|Other', 'Friends tab appears before Other: ' + names.join(', '));

  // 5. Shift+N
  await page.keyboard.press('Shift+N');
  await page.waitForSelector('.natemail-modal-title:has-text("New split")');
  await page.keyboard.type('Investors');
  await page.keyboard.press('Enter');
  await closed();
  check((await toast('Created')).startsWith('Created Investors.'), 'Shift+N creates a split');
  await page.keyboard.press('Shift+N');
  await page.waitForSelector('.natemail-modal-title:has-text("New split")');
  await page.keyboard.type('investors');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.natemail-note:has-text("already a split")');
  check(true, 'duplicate name is refused with a message');
  await page.keyboard.press('Escape');
  await closed();

  // 6. Changing rules while on that split's tab keeps you on the tab
  await page.click('[data-natemail-tab="quo"]');
  await page.waitForSelector('[data-natemail-tab="quo"][aria-selected="true"]');
  await page.waitForTimeout(200);
  await page.keyboard.press('Shift+S'); // cursor is on first row (datadog) again after tab change
  await page.waitForSelector('.natemail-sort-who');
  await page.keyboard.type('quo');
  await page.keyboard.press('Enter');
  await closed();
  await page.waitForSelector('[data-natemail-tab="quo"][aria-selected="true"]');
  const q = await page.evaluate(() => decodeURIComponent(location.hash.slice(8)));
  check(q.startsWith('in:inbox (from:(@datadoghq.com) OR from:"alerts@datadoghq.com")'), 'still on Quo, with its new search: ' + q);

  check(page.errors.length === 0, 'no page errors ' + page.errors.join('; '));
  await ctx.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
