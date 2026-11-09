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
  <div role="main"><div>[toolbar]</div><table id="list" style="width:100%">${rows}</table><div id="pane"></div></div>
  <script>
    window.gmailKeys = [];
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
