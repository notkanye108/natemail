// splits.js
// Pure logic for splits: turning rules into Gmail searches, deciding which
// split "claims" an email, and building the "Other" catch-all.
// No Gmail page access here, so it can be tested with Node (tests/splits.test.js).

(function (root) {
  // A split looks like:
  //   { id: "datadog", name: "Datadog", priority: 5,
  //     rules: [ { type: "domain", value: "datadoghq.com" } ] }
  //
  // Display order = order in the array.
  // Priority = claim order: lower number claims an email first.

  const OTHER_ID = "other";

  const DEFAULT_SPLITS = [
    { id: "important", name: "Important", priority: 6, rules: [{ type: "query", value: "is:important" }] },
    {
      id: "calendar",
      name: "Calendar",
      priority: 1,
      rules: [
        { type: "query", value: "filename:invite.ics" },
        { type: "sender", value: "calendar-notification@google.com" },
      ],
    },
    { id: "matt-levine", name: "Matt Levine", priority: 2, rules: [] },
    { id: "support", name: "Customer support", priority: 3, rules: [] },
    { id: "quo", name: "Quo", priority: 4, rules: [] },
    { id: "datadog", name: "Datadog", priority: 5, rules: [] },
  ];

  const RULE_TYPES = {
    sender: "Just this sender",
    domain: "Anyone at this domain",
    involves: "Any thread this address is on (from, to, or cc)",
    query: "Raw Gmail search",
  };

  function clean(value) {
    return String(value || "").trim();
  }

  // One rule -> one Gmail search fragment. Returns "" for an empty rule.
  function ruleToQuery(rule) {
    const v = clean(rule.value);
    if (!v) return "";
    switch (rule.type) {
      case "sender":
        // Quotes keep Gmail from also matching the sender's aliases.
        return `from:"${v.toLowerCase()}"`;
      case "domain":
        return `from:(@${v.toLowerCase().replace(/^@/, "")})`;
      case "involves": {
        const a = v.toLowerCase();
        return `(from:"${a}" OR to:"${a}" OR cc:"${a}")`;
      }
      case "query":
        return `(${v})`;
      default:
        return "";
    }
  }

  // All of a split's rules joined with OR, in one group. "" if it has none.
  function matchQuery(split) {
    const parts = (split.rules || []).map(ruleToQuery).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];
    return `(${parts.join(" OR ")})`;
  }

  function byPriority(splits) {
    return splits
      .map((s, index) => ({ s, index }))
      .sort((a, b) => a.s.priority - b.s.priority || a.index - b.index)
      .map((x) => x.s);
  }

  // The Gmail search for one tab. Each email lands in exactly one split:
  // a split excludes everything claimed by splits with a lower priority number.
  // Returns "" for a split with no rules (nothing to show yet).
  function tabQuery(splits, splitId) {
    const ordered = byPriority(splits);

    if (splitId === OTHER_ID) {
      const excludes = ordered.map(matchQuery).filter(Boolean).map((q) => `-${q}`);
      return ["in:inbox", ...excludes].join(" ");
    }

    const target = ordered.find((s) => s.id === splitId);
    if (!target) return "";
    const own = matchQuery(target);
    if (!own) return "";

    const excludes = [];
    for (const s of ordered) {
      if (s.id === splitId) break;
      const q = matchQuery(s);
      if (q) excludes.push(`-${q}`);
    }
    return ["in:inbox", own, ...excludes].join(" ");
  }

  // Tabs in display order, with "Other" added at the end.
  function tabs(splits) {
    return [
      ...splits.map((s) => ({ id: s.id, name: s.name, query: tabQuery(splits, s.id) })),
      { id: OTHER_ID, name: "Other", query: tabQuery(splits, OTHER_ID) },
    ];
  }

  // The part of Gmail's URL after "#" for a search.
  function searchHash(query) {
    return "#search/" + encodeURIComponent(query);
  }

  // Reads a Gmail URL hash back into a search string, or null if it isn't a search.
  // Gmail sometimes rewrites spaces as "+", so both forms are accepted.
  function hashToQuery(hash) {
    const m = /^#search\/([^/]*)/.exec(hash || "");
    if (!m) return null;
    try {
      return decodeURIComponent(m[1].replace(/\+/g, " "));
    } catch (e) {
      return null;
    }
  }

  function normalizeQuery(q) {
    return clean(q).replace(/\s+/g, " ").toLowerCase();
  }

  // Which tab (if any) the current Gmail URL is showing.
  function activeTabId(splits, hash) {
    const q = hashToQuery(hash);
    if (q === null) return null;
    const want = normalizeQuery(q);
    const tab = tabs(splits).find((t) => t.query && normalizeQuery(t.query) === want);
    return tab ? tab.id : null;
  }

  // Makes saved data safe to use: fills missing fields, drops broken rules,
  // and renumbers priorities to 1..n keeping their relative order.
  function normalizeSplits(input) {
    if (!Array.isArray(input)) return clone(DEFAULT_SPLITS);
    const seen = new Set();
    const splits = input
      .filter((s) => s && clean(s.name))
      .map((s, i) => {
        let id = clean(s.id) || slug(s.name) || `split-${i}`;
        while (seen.has(id) || id === OTHER_ID) id += "-2";
        seen.add(id);
        return {
          id,
          name: clean(s.name),
          priority: Number.isFinite(Number(s.priority)) ? Number(s.priority) : 1000 + i,
          rules: (Array.isArray(s.rules) ? s.rules : [])
            .filter((r) => r && RULE_TYPES[r.type] && clean(r.value))
            .map((r) => ({ type: r.type, value: clean(r.value) })),
        };
      });
    byPriority(splits).forEach((s, i) => (s.priority = i + 1));
    return splits;
  }

  // ---- Editing splits (used by Shift+S and Shift+N) -------------------------

  // Two rules "cover the same people" if they'd fight over the same mail:
  // same domain, or same address (as sender or anywhere on the thread).
  function sameTarget(a, b) {
    const va = clean(a.value).toLowerCase().replace(/^@/, "");
    const vb = clean(b.value).toLowerCase().replace(/^@/, "");
    if (va !== vb) return false;
    const kind = (t) => (t === "domain" ? "domain" : t === "query" ? "query" : "address");
    return kind(a.type) === kind(b.type);
  }

  // Names of the splits that already have a rule for these people.
  function ownersOf(splits, rule) {
    return splits.filter((s) => s.rules.some((r) => sameTarget(r, rule))).map((s) => s.name);
  }

  // Where a brand-new split should claim mail: ahead of any split that uses
  // Gmail's broad "important" flag, so a specific sender wins over it.
  function newSplitPriority(splits) {
    const broad = byPriority(splits).find((s) =>
      s.rules.some((r) => r.type === "query" && /is:important/i.test(r.value))
    );
    if (broad) return broad.priority - 0.5;
    return Math.max(0, ...splits.map((s) => s.priority)) + 1;
  }

  // Returns a new list with an empty split added (displayed last, before Other).
  function addSplit(splits, name, query) {
    const n = clean(name);
    if (!n) throw new Error("A split needs a name");
    if (n.toLowerCase() === "other") throw new Error("Other is built in. Pick another name");
    if (splits.some((s) => s.name.toLowerCase() === n.toLowerCase())) {
      throw new Error(`There's already a split called ${n}`);
    }
    let id = slug(n) || "split";
    while (id === OTHER_ID || splits.some((s) => s.id === id)) id += "-2";
    const rules = clean(query) ? [{ type: "query", value: clean(query) }] : [];
    const next = clone(splits);
    next.push({ id, name: n, priority: newSplitPriority(splits), rules });
    return { splits: normalizeSplits(next), id };
  }

  // Adds `rule` to split `targetId`, removing it from any other split first so
  // the same people never live in two splits. Returns what moved.
  function addRule(splits, targetId, rule) {
    const value = clean(rule.value).toLowerCase().replace(rule.type === "domain" ? /^@/ : /^$/, "");
    if (!value) throw new Error("Nothing to add");
    if (!RULE_TYPES[rule.type]) throw new Error("Unknown rule type: " + rule.type);
    const added = { type: rule.type, value };

    const next = clone(splits);
    const target = next.find((s) => s.id === targetId);
    if (!target) throw new Error("That split doesn't exist anymore");

    const movedFrom = [];
    for (const s of next) {
      const before = s.rules.length;
      s.rules = s.rules.filter((r) => !sameTarget(r, added));
      if (s.rules.length !== before && s.id !== targetId) movedFrom.push(s.name);
    }
    target.rules.push(added);
    return { splits: normalizeSplits(next), target: target.name, rule: added, movedFrom };
  }

  // How a rule reads in a sentence: "alerts@x.com", "anyone at @x.com", ...
  function describeRule(rule) {
    switch (rule.type) {
      case "sender":
        return rule.value;
      case "domain":
        return "anyone at @" + rule.value.replace(/^@/, "");
      case "involves":
        return "any thread with " + rule.value;
      default:
        return rule.value;
    }
  }

  function slug(name) {
    return clean(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  const api = {
    OTHER_ID,
    DEFAULT_SPLITS,
    RULE_TYPES,
    ruleToQuery,
    matchQuery,
    tabQuery,
    tabs,
    searchHash,
    hashToQuery,
    activeTabId,
    normalizeSplits,
    slug,
    ownersOf,
    addSplit,
    addRule,
    describeRule,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api; // Node (tests)
  } else {
    root.natemail = root.natemail || {};
    root.natemail.splits = api; // Chrome
  }
})(typeof window !== "undefined" ? window : globalThis);
