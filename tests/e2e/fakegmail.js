// A stand-in for Gmail's page: just the parts natemail touches.
module.exports = function fakeGmail(n = 6) {
  const people = [
    ['alerts@datadoghq.com', 'Datadog'], ['noreply@news.bloomberg.com', 'Matt Levine'],
    ['help@pylon.example', 'Support'], ['ceo@customer.com', 'Customer CEO'],
    ['team@quo.com', 'Quo'], ['friend@gmail.com', 'Friend'],
  ];
  const rows = people.slice(0, n).map(([email, name], i) => `
    <tr class="zA" style="height:32px"><td><div role="checkbox" aria-checked="false" class="cb">☐</div></td>
    <td><span email="${email}" name="${name}">${name}</span>${i === 2 ? '<span email="ceo@customer.com" name="CEO">, CEO</span>' : ''}</td>
    <td class="xT"><span data-thread-id="#thread-f:${1000 + i}">Subject ${i}</span></td></tr>`).join('');
  return `<html><head><title>Inbox (3) - nate.c.chandler@gmail.com - Gmail</title></head>
  <body style="margin:0;font-family:sans-serif">
  <div role="main"><div>[toolbar] <span role="button" aria-label="Snooze" id="snooze">⏰</span></div><table id="list" style="width:100%">${rows}</table><div id="pane"></div></div>
  <script>
    window.gmailKeys = [];
    window.snoozed = [];
    // Fake Snooze: menu, then an optional "Pick date & time" dialog.
    const snoozeChecked = (label) => {
      document.querySelectorAll('tr.zA').forEach((r) => {
        if (r.querySelector('.cb').getAttribute('aria-checked') === 'true') { snoozed.push(r.querySelector('.xT').textContent + ' @ ' + label); r.remove(); }
      });
      document.querySelectorAll('.fake-pop').forEach((x) => x.remove());
    };
    document.addEventListener('click', (e) => {
      if (e.target.id === 'snooze') {
        const m = document.createElement('div'); m.className = 'fake-pop'; m.setAttribute('role', 'menu');
        m.innerHTML = ['Later today 6:00 PM', 'Tomorrow Tue, 8:00 AM', 'This weekend Sat, 8:00 AM', 'Next week Mon, 8:00 AM', 'Pick date & time']
          .map((t) => '<div role="menuitem">' + t + '</div>').join('');
        document.body.append(m);
      }
      const item = e.target.closest('[role="menuitem"]');
      if (item && /pick date/i.test(item.textContent)) {
        document.querySelectorAll('.fake-pop').forEach((x) => x.remove());
        const d = document.createElement('div'); d.className = 'fake-pop'; d.setAttribute('role', 'dialog');
        d.innerHTML = '<input aria-label="Date"><input aria-label="Time"><div role="button" id="save">Save</div>';
        document.body.append(d);
      } else if (item) {
        snoozeChecked(item.textContent);
      }
      if (e.target.id === 'save') {
        const [date, time] = [...document.querySelectorAll('[role="dialog"] input')].map((i) => i.value);
        // Like Gmail: only accept the formats it shows.
        if (/^[A-Z][a-z]{2} \\d{1,2}, \\d{4}$/.test(date) && /^\\d{1,2}:\\d{2} [AP]M$/.test(time)) snoozeChecked(date + ' ' + time);
      }
    }, true);
    document.addEventListener('click', (e) => {
      const cb = e.target.closest('.cb');
      if (cb) { const on = cb.getAttribute('aria-checked') !== 'true'; cb.setAttribute('aria-checked', String(on)); cb.textContent = on ? '☑' : '☐'; return; }
      const row = e.target.closest('tr.zA');
      if (row) {
        const id = row.querySelector('[data-thread-id]').getAttribute('data-thread-id').replace(/\\D/g, '');
        location.hash = location.hash.split('/FM')[0] + '/FMfcgzQ' + id + 'abcdefgh';
        document.getElementById('pane').innerHTML = '<h2 class="hP">' + row.querySelector('.xT').textContent + '</h2>' + row.children[1].innerHTML + '<span email="nate.c.chandler@gmail.com">me</span>';
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input')) return;
      window.gmailKeys.push(e.key);
      if (e.key === 'e') {
        document.querySelectorAll('tr.zA').forEach((r) => { if (r.querySelector('.cb').getAttribute('aria-checked') === 'true') r.remove(); });
        // Like real Gmail: a moment after an action, it clears every checkbox.
        setTimeout(() => document.querySelectorAll('.cb').forEach((c) => { c.setAttribute('aria-checked', 'false'); c.textContent = '☐'; }), 150);
      }
    });
  </script></body></html>`;
};
