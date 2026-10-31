'use strict';

/* ================= Constants ================= */

const STORE_KEY = 'studynow.v1';
const DRAFT_KEY = 'studynow.draft';
const IOS_TIP_KEY = 'studynow.iosTipDismissed';

const GOAL_TYPES = {
  exam:     { label: 'Exam',       emoji: '📝', color: '#FF6B8B', placeholder: 'e.g. Math final exam' },
  test:     { label: 'Test',       emoji: '✏️', color: '#FF9F43', placeholder: 'e.g. Science unit test' },
  quiz:     { label: 'Quiz',       emoji: '❓', color: '#F5B700', placeholder: 'e.g. Spelling quiz' },
  study:    { label: 'Self Study', emoji: '🧠', color: '#2EC4B6', placeholder: 'e.g. Revise fractions' },
  homework: { label: 'Homework',   emoji: '🏠', color: '#5B8CFF', placeholder: 'e.g. History homework' },
  project:  { label: 'Project',    emoji: '🎨', color: '#A66CFF', placeholder: 'e.g. Volcano project' },
};

const TASK_KINDS = {
  lesson:    { label: 'Lesson',    emoji: '📖', placeholder: 'e.g. Chapter 4 – Fractions' },
  book:      { label: 'Book',      emoji: '📚', placeholder: 'e.g. Charlotte’s Web, pages 1–40' },
  worksheet: { label: 'Worksheet', emoji: '📄', placeholder: 'e.g. Times tables sheet 2' },
  practice:  { label: 'Practice',  emoji: '🎯', placeholder: 'e.g. 20 minutes of spelling' },
};

const SUBJECTS = [
  ['Math', '➗'], ['Science', '🔬'], ['English', '📚'], ['History', '🏛️'],
  ['Geography', '🌍'], ['Biology', '🌱'], ['Chemistry', '⚗️'], ['Physics', '🧲'],
  ['Art', '🎨'], ['Music', '🎵'], ['Computers', '💻'], ['Languages', '🗣️'],
];

const SUBJECT_COLORS = ['#7C5CFF', '#FF6B8B', '#2EC4B6', '#FF9F43', '#5B8CFF', '#F5B700', '#A66CFF', '#3DBE6B'];

const CHEERS = [
  'Nice job! 🌟', 'You rock! 🎸', 'Keep going! 🚀', 'Brain power! 🧠', 'Awesome! 🎉',
  'One step closer! 👣', 'Superstar! ⭐', 'Way to go! 🙌', 'Crushing it! 💪', 'Smart move! 🦉',
];

const TIPS = [
  'Short study sessions with little breaks work best. Try 25 minutes, then a 5 minute break! ⏰',
  'Explaining a lesson out loud (even to a teddy!) helps you remember it. 🧸',
  'Drink some water — your brain loves it! 💧',
  'Start with the hardest task while your brain is fresh. 💪',
  'Practice tests are a super-power. Try doing a worksheet without peeking! 🦸',
  'A good night’s sleep helps your brain save what you learned. 😴',
  'Tick off one small task right now — you’ve got this! ✅',
];

/* ================= Storage ================= */

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && Array.isArray(s.goals)) return s;
  } catch (_) { /* fall through */ }
  return { name: '', goals: [] };
}

let state = loadState();

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) { /* storage full or blocked */ }
}

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (_) { return null; }
}

function persistDraft() {
  // Only new goals are kept across app restarts; edits are cheap to restart.
  try {
    if (draft && !draft.editingId) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (_) { /* ignore */ }
}

function clearDraft() {
  draft = null;
  try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* ignore */ }
}

/* ================= Helpers ================= */

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const findGoal = id => state.goals.find(g => g.id === id);

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
const todayISO = () => toISO(new Date());
function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISO(d);
}
const daysLeft = iso => Math.round((parseISO(iso) - parseISO(todayISO())) / 86400000);
const prettyDate = iso => parseISO(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function countdown(iso) {
  const n = daysLeft(iso);
  if (n < 0) return { big: '✓', small: 'past', cls: 'past', words: n === -1 ? 'was yesterday' : `was ${-n} days ago` };
  if (n === 0) return { big: '!', small: 'today', cls: 'urgent', words: 'is TODAY' };
  if (n === 1) return { big: '1', small: 'day', cls: 'urgent', words: 'is tomorrow' };
  return { big: String(n), small: 'days', cls: n <= 7 ? 'soon' : 'later', words: `is in ${n} days` };
}

function progress(g) {
  let total = 0, done = 0;
  for (const s of g.subjects) for (const t of s.tasks) { total++; if (t.done) done++; }
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

const isFinished = g => {
  const p = progress(g);
  return daysLeft(g.date) < 0 || (p.total > 0 && p.done === p.total);
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function vibrate(ms) {
  try { navigator.vibrate && navigator.vibrate(ms); } catch (_) { /* ignore */ }
}

/* ================= Routing ================= */

let navCount = 0;
let lastRouteKey = '';
let draft = null;
let pendingStep = null;
let deferredInstall = null;

function route() {
  const [view, id] = location.hash.replace(/^#\/?/, '').split('/');
  return { view: view || 'home', id };
}
const go = path => { location.hash = path; };
function back() {
  if (navCount > 0) history.back();
  else location.replace('#/');
}

window.addEventListener('hashchange', () => { navCount++; render(); });

/* ================= Rendering ================= */

const $app = document.getElementById('app');

function render() {
  const r = route();
  const key = r.view + '/' + (r.id || '');
  let html;

  if (!state.name) {
    html = viewWelcome();
  } else if (r.view === 'goal') {
    const g = findGoal(r.id);
    html = g ? viewGoal(g) : viewHome();
  } else if (r.view === 'new' || r.view === 'edit') {
    if (!prepareDraft(r)) return;
    html = viewWizard();
  } else if (r.view === 'settings') {
    html = viewSettings();
  } else {
    html = viewHome();
  }

  $app.innerHTML = html;
  if (key !== lastRouteKey) {
    window.scrollTo(0, 0);
    lastRouteKey = key;
  }
}

/* ---------- Welcome ---------- */

function viewWelcome() {
  return `
  <section class="welcome">
    <div class="owl-big bob">🦉</div>
    <h1>Hi there!</h1>
    <p>I’m <b>Ollie</b>, your study buddy. I’ll help you get ready for exams, tests and everything in between!</p>
    <label class="label" for="welcome-name">What’s your name?</label>
    <input id="welcome-name" class="field center" maxlength="24" autocomplete="given-name" placeholder="Type your name" data-enter="welcomeGo">
    <button class="btn primary block big" data-action="welcomeGo">Let’s go! 🚀</button>
  </section>`;
}

/* ---------- Home ---------- */

function buddyMessage(upcoming) {
  if (!state.goals.length) return 'Tap the big <b>+ New goal</b> button to add your first exam or study goal!';
  const next = upcoming[0];
  if (next) {
    const n = daysLeft(next.date);
    const p = progress(next);
    const left = p.total - p.done;
    if (n <= 2 && left > 0) {
      return `Your <b>${esc(next.title)}</b> ${countdown(next.date).words}! Just <b>${left}</b> more ${left === 1 ? 'task' : 'tasks'} to go. You can do it! 💪`;
    }
  }
  // Same tip all day so it doesn't flicker between screens.
  const day = Math.floor(Date.now() / 86400000);
  return TIPS[day % TIPS.length];
}

function goalCard(g) {
  const t = GOAL_TYPES[g.type] || GOAL_TYPES.study;
  const c = countdown(g.date);
  const p = progress(g);
  const subjects = g.subjects.map(s => s.emoji).join(' ');
  return `
  <button class="goal-card" data-action="openGoal" data-id="${g.id}" style="--c:${t.color}">
    <span class="gc-emoji">${t.emoji}</span>
    <span class="gc-body">
      <span class="gc-meta">${t.label} · ${prettyDate(g.date)}</span>
      <span class="gc-title">${esc(g.title)}</span>
      ${subjects ? `<span class="gc-subjects">${subjects}</span>` : ''}
      <span class="bar"><i style="width:${p.pct}%"></i></span>
      <span class="gc-progress">${p.total ? `${p.done} of ${p.total} done` : 'No tasks yet'}</span>
    </span>
    <span class="count ${c.cls}"><b>${c.big}</b><small>${c.small}</small></span>
  </button>`;
}

function installBanner() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return '';
  if (deferredInstall) {
    return `<div class="banner"><span>📲 Put Study NOW on your home screen!</span><button class="btn small primary" data-action="install">Install</button></div>`;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let dismissed = false;
  try { dismissed = !!localStorage.getItem(IOS_TIP_KEY); } catch (_) { /* ignore */ }
  if (ios && !dismissed) {
    return `<div class="banner"><span>📲 Tap <b>Share</b> then <b>Add to Home Screen</b> to install this app.</span><button class="icon-btn small" data-action="dismissIosTip" aria-label="Dismiss">✕</button></div>`;
  }
  return '';
}

function viewHome() {
  const sorted = [...state.goals].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter(g => !isFinished(g));
  const finished = sorted.filter(isFinished).reverse();

  let stars = 0, doneToday = 0;
  const today = todayISO();
  for (const g of state.goals) for (const s of g.subjects) for (const t of s.tasks) {
    if (!t.done) continue;
    stars++;
    if (t.doneAt && toISO(new Date(t.doneAt)) === today) doneToday++;
  }

  return `
  <header class="home-head">
    <div>
      <p class="hello">${greeting()},</p>
      <h1>${esc(state.name)} 👋</h1>
    </div>
    <button class="icon-btn" data-action="openSettings" aria-label="Settings">⚙️</button>
  </header>

  <div class="buddy">
    <span class="buddy-owl bob">🦉</span>
    <p class="bubble">${buddyMessage(upcoming)}</p>
  </div>

  <div class="stats">
    <div class="stat" style="--c:#F5B700"><b>⭐ ${stars}</b><small>stars earned</small></div>
    <div class="stat" style="--c:#FF6B8B"><b>${upcoming.length}</b><small>coming up</small></div>
    <div class="stat" style="--c:#2EC4B6"><b>${doneToday}</b><small>done today</small></div>
  </div>

  ${installBanner()}

  <h2 class="section-title">Coming up</h2>
  ${upcoming.length ? `<div class="list">${upcoming.map(goalCard).join('')}</div>` : `
    <div class="empty">
      <div class="empty-emoji">🗓️</div>
      <p>${state.goals.length ? 'Nothing coming up. Enjoy your free time! 🎈' : 'No goals yet!'}</p>
    </div>`}

  ${finished.length ? `
  <details class="finished">
    <summary>🏆 Finished &amp; past <span class="pill">${finished.length}</span></summary>
    <div class="list">${finished.map(goalCard).join('')}</div>
  </details>` : ''}

  <button class="fab" data-action="newGoal"><span>＋</span> New goal</button>`;
}

/* ---------- Goal detail ---------- */

function viewGoal(g) {
  const t = GOAL_TYPES[g.type] || GOAL_TYPES.study;
  const c = countdown(g.date);
  const p = progress(g);
  const n = daysLeft(g.date);
  const countLine = n < 0 ? `This ${c.words}. 🌈` :
    n === 0 ? 'It’s <b>today</b>! Good luck! 🍀' :
    n === 1 ? '<b>Tomorrow!</b>' : `<b>${n}</b> days to go`;

  const subjects = g.subjects.map(s => {
    const sd = s.tasks.filter(x => x.done).length;
    return `
    <section class="subject-card" style="--c:${s.color}">
      <h2><span class="subj-emoji">${s.emoji}</span> ${esc(s.name)} <span class="pill">${sd}/${s.tasks.length}</span></h2>
      ${s.tasks.length ? `<ul class="tasks">${s.tasks.map(task => {
        const k = TASK_KINDS[task.kind] || TASK_KINDS.practice;
        return `
        <li><button class="task ${task.done ? 'done' : ''}" data-action="toggleTask" data-g="${g.id}" data-s="${s.id}" data-t="${task.id}" aria-pressed="${task.done}">
          <span class="check" aria-hidden="true"></span>
          <span class="task-text"><span class="task-title">${esc(task.title)}</span><small>${k.emoji} ${k.label}</small></span>
        </button></li>`;
      }).join('')}</ul>` : '<p class="muted small">No tasks yet.</p>'}
    </section>`;
  }).join('');

  return `
  <header class="topbar">
    <button class="icon-btn" data-action="back" aria-label="Back">←</button>
    <span></span>
    <button class="icon-btn" data-action="editGoal" data-id="${g.id}" aria-label="Edit">✏️</button>
  </header>

  <section class="hero" style="--c:${t.color}">
    <div class="hero-emoji">${t.emoji}</div>
    <div class="hero-type">${t.label} · ${prettyDate(g.date)}</div>
    <h1>${esc(g.title)}</h1>
    <div class="hero-count">${countLine}</div>
    <div class="bar big"><i style="width:${p.pct}%"></i></div>
    <div class="hero-progress">${p.total ? (p.done === p.total ? 'All done — you’re ready! 🏆' : `${p.done} of ${p.total} tasks done · ${p.pct}%`) : 'Add some things to study!'}</div>
  </section>

  ${g.notes ? `<div class="notes">🗒️ ${esc(g.notes)}</div>` : ''}

  ${subjects || `<div class="empty"><div class="empty-emoji">📚</div><p>No subjects yet.</p></div>`}

  <button class="btn block" data-action="editTasks" data-id="${g.id}">＋ Add more to study</button>
  <button class="btn block danger ghost" data-action="deleteGoal" data-id="${g.id}">🗑️ Delete this goal</button>`;
}

/* ---------- Wizard (new / edit goal) ---------- */

function newDraft() {
  return { editingId: null, step: 1, type: '', title: '', date: '', notes: '', subjects: [] };
}

function prepareDraft(r) {
  if (r.view === 'new') {
    if (!draft || draft.editingId) {
      const saved = loadDraft();
      draft = saved && !saved.editingId ? saved : newDraft();
    }
  } else {
    const g = findGoal(r.id);
    if (!g) { location.replace('#/'); return false; }
    if (!draft || draft.editingId !== g.id) {
      draft = { ...JSON.parse(JSON.stringify(g)), editingId: g.id, step: 1 };
    }
  }
  if (pendingStep) { draft.step = pendingStep; pendingStep = null; }
  return true;
}

function viewWizard() {
  const d = draft;
  const editing = !!d.editingId;
  const steps = [1, 2, 3].map(i => {
    const reachable = editing || i < d.step || (i === 2 && d.type) || (i === 3 && d.type && d.date);
    return `<button class="dot ${i === d.step ? 'on' : ''} ${i < d.step ? 'past' : ''}" ${reachable ? `data-action="wizStep" data-step="${i}"` : 'disabled'} aria-label="Step ${i}">${i}</button>`;
  }).join('<span class="dot-line"></span>');

  let body = '';
  if (d.step === 1) {
    body = `
      <h1 class="wiz-q">What’s coming up? 🤔</h1>
      <p class="muted">Pick one</p>
      <div class="type-grid">
        ${Object.entries(GOAL_TYPES).map(([key, t]) => `
          <button class="type-card ${d.type === key ? 'on' : ''}" style="--c:${t.color}" data-action="wizType" data-type="${key}">
            <span class="type-emoji">${t.emoji}</span><span>${t.label}</span>
          </button>`).join('')}
      </div>`;
  } else if (d.step === 2) {
    const t = GOAL_TYPES[d.type] || GOAL_TYPES.study;
    const quick = [['Tomorrow', 1], ['In 3 days', 3], ['In 1 week', 7], ['In 2 weeks', 14]];
    body = `
      <h1 class="wiz-q">${t.emoji} Name &amp; date</h1>
      <label class="label" for="wiz-title">What’s it called?</label>
      <input id="wiz-title" class="field" data-field="title" maxlength="60" value="${esc(d.title)}" placeholder="${t.placeholder}">
      <label class="label" for="wiz-date">When is it? 📅</label>
      <input id="wiz-date" class="field" type="date" data-field="date" value="${esc(d.date)}">
      <div class="chips">
        ${quick.map(([label, n]) => `<button class="chip ${d.date === addDays(n) ? 'on' : ''}" data-action="wizDate" data-days="${n}">${label}</button>`).join('')}
      </div>
      <label class="label" for="wiz-notes">Notes <span class="muted">(optional)</span></label>
      <textarea id="wiz-notes" class="field" data-field="notes" rows="2" maxlength="300" placeholder="e.g. Bring a calculator, room 12">${esc(d.notes)}</textarea>`;
  } else {
    const used = new Set(d.subjects.map(s => s.name.toLowerCase()));
    body = `
      <h1 class="wiz-q">What will you study? 📚</h1>
      <p class="muted">Add your subjects, then the lessons, books, worksheets or practice for each one.</p>
      ${d.subjects.map(wizSubject).join('')}
      <p class="label">${d.subjects.length ? 'Add another subject' : 'Pick a subject'}</p>
      <div class="chips">
        ${SUBJECTS.filter(([name]) => !used.has(name.toLowerCase())).map(([name, emoji]) =>
          `<button class="chip" data-action="wizAddSubject" data-name="${name}" data-emoji="${emoji}">${emoji} ${name}</button>`).join('')}
      </div>
      <div class="row">
        <input id="custom-subject" class="field" maxlength="30" placeholder="Other subject…" data-enter="wizAddCustom">
        <button class="btn" data-action="wizAddCustom">Add</button>
      </div>`;
  }

  return `
  <header class="topbar">
    <button class="icon-btn" data-action="wizCancel" aria-label="Close">✕</button>
    <div class="steps">${steps}</div>
    <span class="icon-btn-spacer"></span>
  </header>
  <section class="wiz">${body}</section>
  <footer class="wiz-foot">
    ${d.step > 1 ? '<button class="btn" data-action="wizBack">← Back</button>' : '<span></span>'}
    ${d.step === 1 ? '' : d.step === 2
      ? '<button class="btn primary" data-action="wizNext">Next →</button>'
      : `<button class="btn primary" data-action="wizSave">${editing ? 'Save ✓' : 'Done! 🎉'}</button>`}
  </footer>`;
}

function wizSubject(s) {
  const kind = s.kind || 'lesson';
  return `
  <div class="w-subject" style="--c:${s.color}">
    <div class="w-subject-head">
      <h3>${s.emoji} ${esc(s.name)}</h3>
      <button class="icon-btn small" data-action="wizRemoveSubject" data-sid="${s.id}" aria-label="Remove ${esc(s.name)}">✕</button>
    </div>
    ${s.tasks.length ? `<ul class="w-tasks">${s.tasks.map(t => `
      <li>
        <span>${(TASK_KINDS[t.kind] || TASK_KINDS.practice).emoji}</span>
        <span class="w-task-title">${esc(t.title)}</span>
        <button class="icon-btn small" data-action="wizRemoveTask" data-sid="${s.id}" data-tid="${t.id}" aria-label="Remove">✕</button>
      </li>`).join('')}</ul>` : ''}
    <div class="kind-picker" role="group" aria-label="Kind of task">
      ${Object.entries(TASK_KINDS).map(([key, k]) => `
        <button class="kind ${kind === key ? 'on' : ''}" data-action="wizKind" data-sid="${s.id}" data-kind="${key}">
          <span>${k.emoji}</span><small>${k.label}</small>
        </button>`).join('')}
    </div>
    <div class="row">
      <input class="field" maxlength="80" data-task-input="${s.id}" data-enter="wizAddTask" data-sid="${s.id}" placeholder="${TASK_KINDS[kind].placeholder}">
      <button class="btn primary" data-action="wizAddTask" data-sid="${s.id}" aria-label="Add task">＋</button>
    </div>
  </div>`;
}

/* ---------- Settings ---------- */

function viewSettings() {
  return `
  <header class="topbar">
    <button class="icon-btn" data-action="back" aria-label="Back">←</button>
    <h1 class="topbar-title">Settings</h1>
    <span class="icon-btn-spacer"></span>
  </header>

  <section class="card">
    <label class="label" for="set-name">Your name</label>
    <div class="row">
      <input id="set-name" class="field" maxlength="24" value="${esc(state.name)}" data-enter="saveName">
      <button class="btn primary" data-action="saveName">Save</button>
    </div>
  </section>

  <section class="card">
    <h2>💾 Backup</h2>
    <p class="muted small">Your goals are saved on this phone only. Make a backup file to keep them safe or move them to a new phone.</p>
    <div class="row">
      <button class="btn" data-action="exportData">⬇️ Save backup</button>
      <button class="btn" data-action="importData">⬆️ Load backup</button>
    </div>
  </section>

  <section class="card">
    <h2>📲 Install the app</h2>
    <p class="muted small"><b>Android (Chrome):</b> tap the ⋮ menu, then <b>Install app</b> or <b>Add to Home screen</b>.</p>
    <p class="muted small"><b>iPhone / iPad (Safari):</b> tap the Share button, then <b>Add to Home Screen</b>.</p>
  </section>

  <section class="card">
    <h2>⚠️ Start over</h2>
    <p class="muted small">Deletes every goal and task on this phone.</p>
    <button class="btn danger" data-action="resetAll">Delete everything</button>
  </section>

  <p class="muted small center">Study NOW · made with 💜</p>`;
}

/* ================= Toast / modal / confetti ================= */

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

function askConfirm(title, message, okLabel) {
  return new Promise(resolve => {
    const m = document.getElementById('modal');
    m.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-emoji">🦉</div>
        <h2>${esc(title)}</h2>
        <p class="muted">${esc(message)}</p>
        <div class="row">
          <button class="btn" data-m="no">Cancel</button>
          <button class="btn primary danger-fill" data-m="yes">${esc(okLabel)}</button>
        </div>
      </div>`;
    m.hidden = false;
    m.onclick = e => {
      const b = e.target.closest('[data-m]');
      if (!b && e.target !== m) return;
      m.hidden = true;
      resolve(!!b && b.dataset.m === 'yes');
    };
  });
}

const confetti = (() => {
  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d');
  const colors = ['#FF6B8B', '#FFC93C', '#2EC4B6', '#7C5CFF', '#5B8CFF', '#FF9F43'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let parts = [];
  let running = false;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function piece(x, y, vx, vy) {
    return { x, y, vx, vy, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, c: pick(colors),
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, life: 1 };
  }

  function start() {
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 30);
    for (const p of parts) {
      p.vy += 0.3; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.006;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (parts.length) requestAnimationFrame(tick);
    else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  return {
    burst(x, y, n = 26) {
      if (reduced) return;
      for (let i = 0; i < n; i++) parts.push(piece(x, y, (Math.random() - 0.5) * 9, -Math.random() * 9 - 3));
      start();
    },
    rain() {
      if (reduced) return;
      for (let i = 0; i < 140; i++) {
        parts.push(piece(Math.random() * innerWidth, -20 - Math.random() * innerHeight * 0.6, (Math.random() - 0.5) * 2, Math.random() * 2));
      }
      start();
    },
  };
})();

/* ================= Actions ================= */

function taskInput(sid) {
  return document.querySelector(`[data-task-input="${sid}"]`);
}

function wizSubjectById(sid) {
  return draft.subjects.find(s => s.id === sid);
}

function addSubject(name, emoji) {
  name = name.trim();
  if (!name) return;
  if (draft.subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
    toast(`${name} is already added`);
    return;
  }
  const s = { id: uid(), name, emoji: emoji || '⭐', color: SUBJECT_COLORS[draft.subjects.length % SUBJECT_COLORS.length], kind: 'lesson', tasks: [] };
  draft.subjects.push(s);
  persistDraft();
  render();
  const input = taskInput(s.id);
  if (input) {
    input.closest('.w-subject').scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus({ preventScroll: true });
  }
}

const actions = {
  welcomeGo() {
    const name = document.getElementById('welcome-name').value.trim();
    if (!name) { toast('What’s your name? 😊'); return; }
    state.name = name;
    save();
    render();
    confetti.rain();
  },

  openSettings: () => go('/settings'),
  newGoal: () => go('/new'),
  openGoal: el => go('/goal/' + el.dataset.id),
  editGoal: el => go('/edit/' + el.dataset.id),
  editTasks(el) { pendingStep = 3; go('/edit/' + el.dataset.id); },
  back,

  install() {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    deferredInstall.userChoice.finally(() => { deferredInstall = null; render(); });
  },

  dismissIosTip() {
    try { localStorage.setItem(IOS_TIP_KEY, '1'); } catch (_) { /* ignore */ }
    render();
  },

  toggleTask(el) {
    const g = findGoal(el.dataset.g);
    const s = g && g.subjects.find(x => x.id === el.dataset.s);
    const t = s && s.tasks.find(x => x.id === el.dataset.t);
    if (!t) return;
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
    save();
    if (t.done) {
      const r = el.getBoundingClientRect();
      vibrate(25);
      const p = progress(g);
      if (p.done === p.total) {
        confetti.rain();
        toast('WOW! Everything done! You’re ready! 🏆');
      } else {
        confetti.burst(r.left + 34, r.top + r.height / 2);
        toast(pick(CHEERS));
      }
    }
    render();
  },

  async deleteGoal(el) {
    const g = findGoal(el.dataset.id);
    if (!g) return;
    if (!(await askConfirm('Delete this goal?', `“${g.title}” and all its tasks will be gone.`, 'Delete'))) return;
    state.goals = state.goals.filter(x => x.id !== g.id);
    save();
    location.replace('#/');
    toast('Goal deleted');
  },

  /* ----- wizard ----- */
  async wizCancel() {
    const hasWork = draft && !draft.editingId && (draft.type || draft.title || draft.subjects.length);
    if (hasWork && !(await askConfirm('Stop adding this goal?', 'What you typed so far won’t be saved.', 'Stop'))) return;
    clearDraft();
    back();
  },
  wizStep(el) { draft.step = Number(el.dataset.step); persistDraft(); render(); },
  wizBack() { draft.step--; persistDraft(); render(); },
  wizType(el) {
    draft.type = el.dataset.type;
    draft.step = 2;
    persistDraft();
    render();
  },
  wizDate(el) {
    draft.date = addDays(Number(el.dataset.days));
    persistDraft();
    render();
  },
  wizNext() {
    if (draft.step === 2 && !draft.date) {
      toast('Pick a date first 📅');
      const input = document.getElementById('wiz-date');
      input.classList.remove('shake');
      void input.offsetWidth;
      input.classList.add('shake');
      return;
    }
    draft.step++;
    persistDraft();
    render();
  },
  wizAddSubject(el) { addSubject(el.dataset.name, el.dataset.emoji); },
  wizAddCustom() {
    const input = document.getElementById('custom-subject');
    if (!input.value.trim()) { input.focus(); return; }
    addSubject(input.value, '⭐');
  },
  async wizRemoveSubject(el) {
    const s = wizSubjectById(el.dataset.sid);
    if (s.tasks.length && !(await askConfirm(`Remove ${s.name}?`, 'Its tasks will be removed too.', 'Remove'))) return;
    draft.subjects = draft.subjects.filter(x => x.id !== s.id);
    persistDraft();
    render();
  },
  wizKind(el) {
    const s = wizSubjectById(el.dataset.sid);
    s.kind = el.dataset.kind;
    const typed = taskInput(s.id).value;
    persistDraft();
    render();
    const input = taskInput(s.id);
    input.value = typed;
    input.focus({ preventScroll: true });
  },
  wizAddTask(el) {
    const s = wizSubjectById(el.dataset.sid);
    const input = taskInput(s.id);
    const title = input.value.trim();
    if (!title) { input.focus(); toast('Type what to study first ✏️'); return; }
    s.tasks.push({ id: uid(), kind: s.kind || 'lesson', title, done: false, doneAt: null });
    persistDraft();
    render();
    taskInput(s.id).focus({ preventScroll: true });
  },
  wizRemoveTask(el) {
    const s = wizSubjectById(el.dataset.sid);
    s.tasks = s.tasks.filter(t => t.id !== el.dataset.tid);
    persistDraft();
    render();
  },
  wizSave() {
    // Catch tasks typed but not yet added with the + button.
    for (const s of draft.subjects) {
      const input = taskInput(s.id);
      const title = input && input.value.trim();
      if (title) s.tasks.push({ id: uid(), kind: s.kind || 'lesson', title, done: false, doneAt: null });
    }
    const d = draft;
    const goal = {
      id: d.editingId || uid(),
      type: d.type || 'study',
      title: d.title.trim() || GOAL_TYPES[d.type || 'study'].label,
      date: d.date,
      notes: d.notes.trim(),
      subjects: d.subjects.map(({ kind, ...s }) => s),
      createdAt: d.createdAt || Date.now(),
    };
    const i = state.goals.findIndex(g => g.id === goal.id);
    if (i >= 0) state.goals[i] = goal; else state.goals.push(goal);
    save();
    const wasEditing = !!d.editingId;
    clearDraft();
    if (wasEditing) {
      back();
      toast('Saved! ✅');
    } else {
      location.replace('#/goal/' + goal.id);
      confetti.rain();
      toast('Goal added! Let’s do this! 🎯');
    }
  },

  /* ----- settings ----- */
  saveName() {
    const name = document.getElementById('set-name').value.trim();
    if (!name) { toast('Name can’t be empty'); return; }
    state.name = name;
    save();
    toast('Saved! ✅');
  },
  exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `study-now-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup saved! 💾');
  },
  importData() { document.getElementById('import-file').click(); },
  async resetAll() {
    if (!(await askConfirm('Delete everything?', 'All goals and tasks will be gone forever.', 'Delete all'))) return;
    state = { name: state.name, goals: [] };
    save();
    clearDraft();
    location.replace('#/');
    toast('All clear! Fresh start ✨');
  },
};

document.getElementById('import-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.goals)) throw new Error('bad file');
    if (!(await askConfirm('Load this backup?', `It has ${data.goals.length} goal(s). Your current goals will be replaced.`, 'Load'))) return;
    state = { name: data.name || state.name, goals: data.goals };
    save();
    toast('Backup loaded! 🎉');
    location.replace('#/');
    render();
  } catch (_) {
    toast('Oops, that file isn’t a Study NOW backup');
  }
});

/* ================= Global events ================= */

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el, e);
});

document.addEventListener('input', e => {
  const field = e.target.dataset.field;
  if (field && draft) {
    draft[field] = e.target.value;
    persistDraft();
  }
});

document.addEventListener('change', e => {
  // Re-render so the quick-date chips highlight the picked date.
  if (e.target.dataset.field === 'date' && draft) render();
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const name = e.target.dataset && e.target.dataset.enter;
  if (name && actions[name]) {
    e.preventDefault();
    actions[name](e.target, e);
  }
});

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  if (route().view === 'home') render();
});

// Refresh countdowns when the app comes back to the front on a new day.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && route().view !== 'new' && route().view !== 'edit') render();
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

render();
