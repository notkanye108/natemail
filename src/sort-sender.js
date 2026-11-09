// sort-sender.js
// Shift+S: put this thread's sender (or anyone at their domain, or any thread
// with a given address) into a split. Shift+N: make a new split.

(function () {
  const natemail = window.natemail;
  const S = natemail.splits;
  const dom = natemail.dom;
  const store = natemail.store;

  // Domains shared by millions of people. "Anyone at gmail.com" is never what
  // you want, so that choice is turned off for these.
  const SHARED_DOMAINS = new Set([
    "gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com",
    "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com",
  ]);

  // The people on the thread you're pointing at: the cursor row in the list,
  // plus everyone in the open thread if it's the same one.
  function currentAddresses() {
    const me = dom.myEmail();
    let found = [];
    const row = natemail.selection.cursorRow();
    if (row) found = dom.addressesIn(row);

    const thread = dom.openThread();
    if (thread) {
      const subject = (thread.querySelector("h2.hP") || {}).textContent || "";
      const sameThread = !row || (subject && row.textContent.includes(subject.trim()));
      if (sameThread) found = found.concat(dom.addressesIn(thread));
    }

    const seen = new Set();
    return found.filter((a) => {
      if (a.email === me || seen.has(a.email)) return false;
      seen.add(a.email);
      return true;
    });
  }

  function domainOf(email) {
    return email.split("@")[1] || "";
  }

  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  async function sortSender() {
    const addresses = currentAddresses();
    if (addresses.length === 0) {
      natemail.toast("Point the cursor at a thread (or open one) first.");
      return;
    }
    let splits = await store.loadSplits();
    let addrIndex = 0;
    let mode = "sender";
    let highlight = 0;

    natemail.ui.modal({
      title: "Sort into a split",
      build(panel, close) {
        const who = el("div", "natemail-sort-who");
        const modes = el("div", "natemail-sort-modes");
        const input = el("input", "natemail-input");
        input.placeholder = "Split name, or type a new one";
        const list = el("div", "natemail-options");
        const note = el("div", "natemail-note");
        panel.append(who, modes, input, list, note);

        const address = () => addresses[addrIndex];

        function rule() {
          const a = address().email;
          return mode === "domain" ? { type: "domain", value: domainOf(a) } : { type: mode, value: a };
        }

        function choices() {
          const q = input.value.trim().toLowerCase();
          const matches = splits.filter((s) => s.name.toLowerCase().includes(q));
          const exact = splits.some((s) => s.name.toLowerCase() === q);
          const out = matches.map((s) => ({ id: s.id, label: s.name }));
          if (q && !exact && q !== "other") out.push({ create: input.value.trim(), label: `Create “${input.value.trim()}”` });
          return out;
        }

        function draw() {
          const a = address();
          who.replaceChildren(
            el("strong", "", a.email),
            el("span", "natemail-muted", a.name && a.name.toLowerCase() !== a.email ? "  " + a.name : "")
          );
          if (addresses.length > 1) {
            who.append(el("span", "natemail-hint", `Tab: next address (${addrIndex + 1} of ${addresses.length})`));
          }

          const shared = SHARED_DOMAINS.has(domainOf(a.email));
          if (shared && mode === "domain") mode = "sender";
          const options = [
            ["sender", "1", "Just from this address"],
            ["domain", "2", shared ? `Anyone at @${domainOf(a.email)} (off: shared domain)` : `Anyone at @${domainOf(a.email)}`],
            ["involves", "3", "Any thread this address is on"],
          ];
          modes.replaceChildren(
            ...options.map(([value, key, label]) => {
              const b = el("button", "natemail-mode");
              b.type = "button";
              b.append(el("kbd", "", key), document.createTextNode(" " + label));
              b.setAttribute("aria-pressed", String(mode === value));
              b.disabled = value === "domain" && shared;
              b.addEventListener("click", () => {
                mode = value;
                draw();
                input.focus();
              });
              return b;
            })
          );

          const c = choices();
          highlight = Math.max(0, Math.min(highlight, c.length - 1));
          list.replaceChildren(
            ...c.map((choice, i) => {
              const row = el("div", "natemail-option" + (choice.create ? " natemail-option--create" : ""), choice.label);
              row.setAttribute("aria-selected", String(i === highlight));
              row.addEventListener("mousedown", (e) => {
                e.preventDefault();
                highlight = i;
                confirm();
              });
              return row;
            })
          );

          const owners = S.ownersOf(splits, rule());
          const target = c[highlight];
          const elsewhere = owners.filter((n) => !target || n !== target.label);
          note.textContent = elsewhere.length ? `Currently in ${elsewhere.join(", ")}. Enter moves it.` : "";
        }

        let busy = false;
        async function confirm() {
          const choice = choices()[highlight];
          if (!choice || busy) return;
          busy = true;
          try {
            let current = await store.loadSplits();
            let targetId = choice.id;
            if (choice.create) {
              const made = S.addSplit(current, choice.create);
              current = made.splits;
              targetId = made.id;
            }
            const result = S.addRule(current, targetId, rule());
            await store.saveSplits(result.splits);
            close();
            const moved = result.movedFrom.length ? ` (moved from ${result.movedFrom.join(", ")})` : "";
            natemail.toast(`${result.target} now includes ${S.describeRule(result.rule)}${moved}`, { ms: 4000 });
          } catch (err) {
            busy = false;
            note.textContent = err.message;
          }
        }

        input.addEventListener("input", () => {
          highlight = 0;
          draw();
        });
        input.addEventListener("keydown", (e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            if (addresses.length > 1) {
              addrIndex = (addrIndex + (e.shiftKey ? addresses.length - 1 : 1)) % addresses.length;
              draw();
            }
          } else if (!input.value && ["1", "2", "3"].includes(e.key)) {
            e.preventDefault();
            const wanted = { 1: "sender", 2: "domain", 3: "involves" }[e.key];
            if (!(wanted === "domain" && SHARED_DOMAINS.has(domainOf(address().email)))) mode = wanted;
            draw();
          } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const n = choices().length;
            if (n) highlight = (highlight + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
            draw();
          } else if (e.key === "Enter") {
            e.preventDefault();
            confirm();
          }
        });

        draw();
      },
    });
  }

  function newSplit() {
    natemail.ui.modal({
      title: "New split",
      build(panel, close) {
        const name = el("input", "natemail-input");
        name.placeholder = "Name, for example Investors";
        const query = el("input", "natemail-input");
        query.placeholder = "Gmail search (optional), for example label:investors";
        const note = el("div", "natemail-note");
        note.textContent = "Leave the search empty and add senders later with Shift+S.";
        panel.append(name, query, note);

        let busy = false;
        async function create() {
          if (busy) return;
          busy = true;
          try {
            const made = S.addSplit(await store.loadSplits(), name.value, query.value);
            await store.saveSplits(made.splits);
            close();
            natemail.toast(
              query.value.trim()
                ? `Created ${name.value.trim()}.`
                : `Created ${name.value.trim()}. Press Shift+S on an email to add senders.`,
              { ms: 4000 }
            );
          } catch (err) {
            busy = false;
            note.textContent = err.message;
            note.classList.add("natemail-note--error");
          }
        }
        for (const input of [name, query]) {
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              create();
            }
          });
        }
      },
    });
  }

  natemail.keys.register({ key: "S", label: "Shift+S", help: "Sort this sender into a split", run: sortSender });
  natemail.keys.register({ key: "N", label: "Shift+N", help: "Make a new split", run: newSplit });
})();
