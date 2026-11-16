// Practice log: pure helpers, no DOM (tested in test/edit.test.mjs).
// An entry is recorded when a session ends after at least a minute:
//   { id, dateISO, minutes, practicedSec, completed, style, level, focus, poses }
// dateISO is a full timestamp; days and streaks use the device's local date.

export const HISTORY_CAP = 1000;

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dayKey = (iso) => keyOf(new Date(iso));
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };

function normalizeEntry(h) {
  if (!h || typeof h !== "object" || !h.dateISO || !Number.isFinite(Date.parse(h.dateISO))) return null;
  const str = (v) => (typeof v === "string" ? v : undefined);
  return {
    id: typeof h.id === "string" && h.id ? h.id : `h_${Date.parse(h.dateISO).toString(36)}`,
    dateISO: new Date(h.dateISO).toISOString(),
    minutes: Number.isFinite(h.minutes) ? h.minutes : undefined,
    practicedSec: Number.isFinite(h.practicedSec) ? Math.max(0, Math.round(h.practicedSec)) : 0,
    completed: !!h.completed,
    style: str(h.style), level: str(h.level), focus: str(h.focus),
    poses: Number.isFinite(h.poses) ? h.poses : undefined,
  };
}

export const History = {
  // Valid entries only, oldest first, capped.
  normalize(list) {
    const out = (Array.isArray(list) ? list : []).map(normalizeEntry).filter(Boolean);
    out.sort((a, b) => (a.dateISO < b.dateISO ? -1 : a.dateISO > b.dateISO ? 1 : 0));
    return out.slice(-HISTORY_CAP);
  },
  // Union by id (entries already here win).
  merge(mine, incoming) {
    const seen = new Set(mine.map((h) => h.id));
    const add = History.normalize(incoming).filter((h) => !seen.has(h.id));
    return History.normalize([...mine, ...add]);
  },
};

// Current streak counts consecutive practice days ending today, or yesterday
// (today isn't over yet). Longest is the best run ever.
export function streaks(history, now = new Date()) {
  const days = [...new Set(history.map((h) => dayKey(h.dateISO)))].sort();
  if (!days.length) return { current: 0, longest: 0, days: 0 };
  let longest = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    run = keyOf(addDays(new Date(days[i - 1] + "T00:00"), 1)) === days[i] ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const set = new Set(days);
  let d = new Date(now);
  if (!set.has(keyOf(d))) d = addDays(d, -1);
  let current = 0;
  while (set.has(keyOf(d))) { current++; d = addDays(d, -1); }
  return { current, longest, days: days.length };
}

export function totals(history) {
  return { sessions: history.length, seconds: history.reduce((s, h) => s + (h.practicedSec || 0), 0) };
}

// The last `weeks` whole weeks (Sunday first), oldest first, ending with the
// week that contains `now`. Days after today are marked `future`.
export function weekGrid(history, weeks, now = new Date()) {
  const mins = new Map();
  for (const h of history) { const k = dayKey(h.dateISO); mins.set(k, (mins.get(k) || 0) + (h.practicedSec || 0) / 60); }
  const today = keyOf(now);
  const start = addDays(now, -now.getDay() - 7 * (weeks - 1));
  const out = [];
  for (let i = 0; i < weeks * 7; i++) {
    const key = keyOf(addDays(start, i));
    out.push({ key, minutes: Math.round(mins.get(key) || 0), future: key > today });
  }
  return out;
}
