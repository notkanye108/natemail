// date-parse.js
// Turns what you type in the Remind me box into a date and time.
//
//   2h, 30m, 3d, 1w, in 2 hours      → from now
//   9am, 2:30pm, noon, tonight       → today (or tomorrow if that's passed)
//   tomorrow, tmrw 9am               → tomorrow (8am if no time)
//   mon, monday 2pm, next fri        → next one of that day (8am if no time)
//   nov 20, 20 nov 10am, 11/20       → that date (8am if no time; next year if passed)
//   this weekend, next week          → Sat 8am, Mon 8am
//
// No Gmail page access here, so it's tested with Node (tests/date-parse.test.js).

(function (root) {
  const DEFAULT_HOUR = 8;
  const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  function at(date, h, m = 0) {
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function dayIndex(word) {
    if (!/^[a-z]{3,9}$/.test(word)) return -1;
    if (word === "tues") return 2;
    if (word === "thur" || word === "thurs") return 4;
    const i = DAYS.indexOf(word.slice(0, 3));
    if (i === -1) return -1;
    const full = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][i];
    return full.startsWith(word) ? i : -1;
  }

  function monthIndex(word) {
    if (!/^[a-z]{3,9}$/.test(word)) return -1;
    const i = MONTHS.indexOf(word.slice(0, 3));
    if (i === -1) return -1;
    const full = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][i];
    return full.startsWith(word) || (word === "sept" && i === 8) ? i : -1;
  }

  // "9", "9am", "9:30", "9:30pm", "21:00", "noon", "midnight" → [hour, minute]
  // A bare 1–7 means afternoon (nobody sets a reminder for 3am by typing "3").
  function parseTime(text) {
    const t = text.replace(/\s+/g, "");
    if (t === "noon") return [12, 0];
    if (t === "midnight") return [0, 0];
    const m = /^(\d{1,2})(?::(\d{2}))?(am|pm|a|p)?$/.exec(t);
    if (!m) return null;
    let h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    const ap = m[3] ? m[3][0] : "";
    if (min > 59) return null;
    if (ap) {
      if (h < 1 || h > 12) return null;
      if (ap === "p" && h !== 12) h += 12;
      if (ap === "a" && h === 12) h = 0;
    } else {
      if (h > 23) return null;
      if (!m[2] && h >= 1 && h <= 7) h += 12;
    }
    return [h, min];
  }

  // Splits "tomorrow 9am" into the day part and an optional time at the end.
  function splitTime(text) {
    const m = /^(.*?)\s*(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p)?|noon|midnight)$/.exec(text);
    if (m && m[1] && parseTime(m[2])) return [m[1].trim(), parseTime(m[2])];
    return [text, null];
  }

  function parse(input, now = new Date()) {
    let text = String(input || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/[.,]$/, "");
    if (!text) return null;
    text = text.replace(/^in /, "");

    // Relative: 2h, 30m, 3d, 1w, "2 hours", "3 days"
    const rel = /^(\d+(?:\.\d+)?) ?(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?|w|wk|wks|weeks?)$/.exec(text);
    if (rel) {
      const n = Number(rel[1]);
      const unit = rel[2][0];
      const ms = { m: 60e3, h: 3600e3, d: 86400e3, w: 7 * 86400e3 }[unit];
      if (unit === "d" || unit === "w") {
        return at(addDays(now, Math.round(n * (unit === "w" ? 7 : 1))), DEFAULT_HOUR);
      }
      return new Date(now.getTime() + n * ms);
    }

    if (text === "later today" || text === "later") {
      const d = new Date(now.getTime() + 3 * 3600e3);
      d.setMinutes(0, 0, 0);
      return d;
    }
    if (text === "tonight") return at(now, 20) > now ? at(now, 20) : null;
    if (text === "this weekend" || text === "weekend") {
      const toSat = (6 - now.getDay() + 7) % 7 || 7;
      return at(addDays(now, now.getDay() === 6 ? 7 : toSat), DEFAULT_HOUR);
    }
    if (text === "next week") {
      const toMon = (1 - now.getDay() + 7) % 7 || 7;
      return at(addDays(now, toMon), DEFAULT_HOUR);
    }

    // A time on its own: today, or tomorrow if it's already passed.
    const timeOnly = parseTime(text);
    if (timeOnly && /[a-z:]/.test(text)) {
      const d = at(now, timeOnly[0], timeOnly[1]);
      return d > now ? d : addDays(d, 1);
    }

    // "nov 20" could be "nov" at 20:00, or November 20th. Try with a time
    // split off first, then the whole thing as a date.
    const [dayPart, time] = splitTime(text);
    if (time) {
      const d = parseDay(dayPart, time[0], time[1], now);
      if (d) return d;
    }
    return parseDay(text, DEFAULT_HOUR, 0, now);
  }

  function parseDay(dayPart, h, min, now) {
    if (dayPart === "today") {
      const d = at(now, h, min);
      return d > now ? d : null;
    }
    if (["tomorrow", "tmrw", "tmr", "tom"].includes(dayPart)) return at(addDays(now, 1), h, min);

    // Weekday: "mon", "next friday"
    const wd = /^(?:next |this |on )?([a-z]+)$/.exec(dayPart);
    if (wd && dayIndex(wd[1]) !== -1) {
      const ahead = (dayIndex(wd[1]) - now.getDay() + 7) % 7 || 7;
      return at(addDays(now, ahead), h, min);
    }

    // Dates: "nov 20", "20 nov", "november 20th", "11/20", "11/20/2027"
    let month = -1;
    let day = -1;
    let year = null;
    let m;
    if ((m = /^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/.exec(dayPart)) && monthIndex(m[1]) !== -1) {
      [month, day, year] = [monthIndex(m[1]), Number(m[2]), m[3] ? Number(m[3]) : null];
    } else if ((m = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)(?: (\d{4}))?$/.exec(dayPart)) && monthIndex(m[2]) !== -1) {
      [month, day, year] = [monthIndex(m[2]), Number(m[1]), m[3] ? Number(m[3]) : null];
    } else if ((m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(dayPart))) {
      [month, day, year] = [Number(m[1]) - 1, Number(m[2]), m[3] ? Number(m[3].length === 2 ? "20" + m[3] : m[3]) : null];
    }
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const build = (y) => {
        const d = new Date(y, month, day, h, min, 0, 0);
        return d.getMonth() === month ? d : null; // rejects "feb 31"
      };
      if (year) {
        const d = build(year);
        return d && d > now ? d : null;
      }
      const d = build(now.getFullYear());
      if (d && d > now) return d;
      return build(now.getFullYear() + 1);
    }

    return null;
  }

  // "Tue, Nov 10, 9:00 AM"
  function format(date) {
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const api = { parse, parseTime, format };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else {
    root.natemail = root.natemail || {};
    root.natemail.dates = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
