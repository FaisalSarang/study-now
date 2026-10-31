'use strict';

/* Deadline reminders, shared by the app page and the service worker.
   The page keeps a small copy of the goals in Cache Storage so the service
   worker can check deadlines in the background (Periodic Background Sync,
   Chrome on Android with the app installed). */

const REMINDER_STORE = 'studynow-data';
const REMINDER_DATA_URL = './__reminder-data';
const REMINDER_SENT_URL = './__reminder-sent';
const REMINDER_DEFAULT_DAYS = [3, 1, 0];
const REMINDER_OPTIONS = [[7, '1 week before'], [3, '3 days before'], [1, '1 day before'], [0, 'On the day']];

async function readReminderJSON(url) {
  try {
    const res = await (await caches.open(REMINDER_STORE)).match(url);
    return res ? await res.json() : null;
  } catch (_) { return null; }
}

async function writeReminderJSON(url, data) {
  try {
    const cache = await caches.open(REMINDER_STORE);
    await cache.put(url, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
  } catch (_) { /* storage blocked */ }
}

function reminderDaysLeft(iso, now) {
  const [y, m, d] = iso.split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, d) - today) / 86400000);
}

// One reminder per goal per threshold: a goal 2 days away with thresholds
// [3, 1, 0] gets the "3 days" reminder once, then "1 day", then "on the day".
function dueReminders(data, sent, now) {
  if (!data || !data.enabled) return [];
  const days = [...(data.days || REMINDER_DEFAULT_DAYS)].sort((a, b) => a - b);
  const due = [];
  for (const g of data.goals || []) {
    if (g.total > 0 && g.left === 0) continue;
    const n = reminderDaysLeft(g.date, now);
    if (n < 0) continue;
    const threshold = days.find(d => n <= d);
    if (threshold === undefined) continue;
    const key = `${g.id}:${g.date}:${threshold}`;
    if (!sent[key]) due.push({ key, goal: g, n });
  }
  return due;
}

function reminderText(g, n) {
  const when = n === 0 ? 'is TODAY' : n === 1 ? 'is tomorrow' : `is in ${n} days`;
  const things = `${g.left} ${g.left === 1 ? 'thing' : 'things'}`;
  let body;
  if (g.total === 0) body = 'Tap to plan what to study 📚';
  else if (n === 0) body = `Quick review of ${things} left, then good luck! 🍀`;
  else body = `${things} left to study. You’ve got this! 💪`;
  return { title: `${g.emoji} ${g.title} ${when}!`, body };
}

async function checkReminders(registration, { quietHours = false } = {}) {
  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return 0;
  const now = new Date();
  // Background checks stay quiet at night.
  if (quietHours && (now.getHours() < 8 || now.getHours() >= 21)) return 0;

  const data = await readReminderJSON(REMINDER_DATA_URL);
  const sent = (await readReminderJSON(REMINDER_SENT_URL)) || {};
  const due = dueReminders(data, sent, now);
  let shown = 0;
  for (const r of due) {
    const { title, body } = reminderText(r.goal, r.n);
    try {
      await registration.showNotification(title, {
        body,
        icon: 'icons/icon-192.png',
        badge: 'icons/badge-96.png',
        tag: 'goal-' + r.goal.id,
        data: { url: './#/goal/' + r.goal.id },
      });
      sent[r.key] = Date.now();
      shown++;
    } catch (_) { /* permission revoked */ }
  }
  if (shown) await writeReminderJSON(REMINDER_SENT_URL, sent);
  return shown;
}
