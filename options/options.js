// options.js
// Edit splits: names, rules, display order, and claim order.

(function () {
  const S = window.natemail.splits;
  const store = window.natemail.store;
  const root = document.getElementById("splits");
  const status = document.getElementById("status");

  let splits = [];

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
  }

  function say(text, error = false) {
    status.textContent = text;
    status.className = error ? "error" : "";
  }

  function render() {
    root.replaceChildren(...splits.map(renderSplit));
  }

  function renderSplit(split, index) {
    const name = el("input", { className: "name", value: split.name, placeholder: "Split name" });
    name.addEventListener("input", () => {
      split.name = name.value;
      updatePreview();
    });

    const priority = el("input", { className: "priority", type: "number", min: 1, value: split.priority });
    priority.addEventListener("input", () => {
      split.priority = Number(priority.value);
      updatePreview();
    });

    const up = el("button", { type: "button", className: "small", textContent: "↑", title: "Move tab left" });
    up.disabled = index === 0;
    up.addEventListener("click", () => move(index, -1));
    const down = el("button", { type: "button", className: "small", textContent: "↓", title: "Move tab right" });
    down.disabled = index === splits.length - 1;
    down.addEventListener("click", () => move(index, 1));
    const del = el("button", { type: "button", className: "small", textContent: "Delete" });
    del.addEventListener("click", () => {
      if (!confirm(`Delete the "${split.name}" split?`)) return;
      splits.splice(index, 1);
      render();
    });

    const rules = el("div");
    if (split.rules.length === 0) {
      rules.append(el("div", { className: "empty", textContent: "No rules yet, so this tab is empty." }));
    }
    split.rules.forEach((rule, ri) => rules.append(renderRule(split, rule, ri)));

    const addRule = el("button", { type: "button", className: "small", textContent: "+ Add rule" });
    addRule.style.marginTop = "8px";
    addRule.addEventListener("click", () => {
      split.rules.push({ type: "sender", value: "" });
      render();
    });

    const preview = el("div", { className: "preview" });
    function updatePreview() {
      const q = S.tabQuery(splits.filter((s) => s.name.trim()), split.id);
      preview.textContent = q ? "Gmail search: " + q : "";
    }
    preview.update = updatePreview;
    updatePreview();

    const box = el(
      "div",
      { className: "split" },
      el(
        "div",
        { className: "split-head" },
        name,
        el("label", {}, "Claim order", priority),
        up,
        down,
        del
      ),
      rules,
      addRule,
      preview
    );
    return box;
  }

  function renderRule(split, rule, ri) {
    const type = el(
      "select",
      {},
      ...Object.entries(S.RULE_TYPES).map(([value, label]) => el("option", { value, textContent: label }))
    );
    type.value = rule.type;
    type.addEventListener("change", () => {
      rule.type = type.value;
      refreshPreviews();
    });

    const value = el("input", {
      className: "value",
      value: rule.value,
      placeholder: placeholderFor(rule.type),
    });
    value.addEventListener("input", () => {
      rule.value = value.value;
      refreshPreviews();
    });
    type.addEventListener("change", () => (value.placeholder = placeholderFor(type.value)));

    const remove = el("button", { type: "button", className: "small", textContent: "Remove" });
    remove.addEventListener("click", () => {
      split.rules.splice(ri, 1);
      render();
    });

    return el("div", { className: "rule" }, type, value, remove);
  }

  function placeholderFor(type) {
    return {
      sender: "alerts@datadoghq.com",
      domain: "datadoghq.com",
      involves: "support@yourcompany.com",
      query: "is:important",
    }[type];
  }

  // Any edit can change other splits' searches (because of claim order).
  function refreshPreviews() {
    root.querySelectorAll(".preview").forEach((p) => p.update && p.update());
  }

  function move(index, delta) {
    const [s] = splits.splice(index, 1);
    splits.splice(index + delta, 0, s);
    render();
  }

  document.getElementById("add-split").addEventListener("click", () => {
    const n = splits.length + 1;
    splits.push({ id: "split-" + Date.now(), name: "New split " + n, priority: n, rules: [] });
    render();
  });

  document.getElementById("save").addEventListener("click", async () => {
    try {
      splits = await store.saveSplits(splits);
      render();
      say("Saved. Gmail updates right away.");
    } catch (err) {
      say("Couldn't save: " + err.message, true);
    }
  });

  document.getElementById("reset").addEventListener("click", async () => {
    if (!confirm("Replace all splits with the defaults?")) return;
    splits = await store.saveSplits(S.DEFAULT_SPLITS);
    render();
    say("Reset to defaults.");
  });

  store.loadSplits().then((loaded) => {
    splits = loaded;
    render();
  });
})();
