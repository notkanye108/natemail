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
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api; // Node (tests)
  } else {
    root.natemail = root.natemail || {};
    root.natemail.splits = api; // Chrome
  }
})(typeof window !== "undefined" ? window : globalThis);
