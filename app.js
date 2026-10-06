const activities = [
  { icon: '🔥', name: 'Productive', color: 'var(--study)' },
  { icon: '➖', name: 'Non-productive', color: 'var(--work)' },
  { icon: '✕', name: 'Time waste', color: 'var(--waste)' },
  { icon: '☻', name: 'Daily activities', color: 'var(--daily)' },
  { icon: '🔧', name: 'Tinkering', color: 'var(--tinker)' },
];
let selected = 'Productive';
const tracked = new Map();
function getDayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
let dayKey = getDayKey();

function currentState() {
  return { slots: Object.fromEntries([...tracked].filter(([, activity]) => activity)), selected };
}
function persistState() {
  const state = currentState();
  localStorage.setItem(`timeflow-${dayKey}`, JSON.stringify(state));
}
async function restoreState() {
  const state = JSON.parse(localStorage.getItem(`timeflow-${dayKey}`) || 'null');
  if (!state) return;
  const oldNames = { study: 'Productive', work: 'Non-productive', waste: 'Time waste', daily: 'Daily activities', tinker: 'Tinkering' };
  Object.entries(state.slots || {}).forEach(([key, activity]) => {
    const name = oldNames[activity] || activity;
    if (activities.some(item => item.name === name)) tracked.set(key, name);
  });
  selected = oldNames[state.selected] || state.selected;
  if (!activities.some(activity => activity.name === selected)) selected = 'Productive';
}
function scheduleDailyReset() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  setTimeout(() => {
    dayKey = getDayKey();
    tracked.clear(); selected = 'Productive';
    renderPicker(); renderTimeline(); renderSummary(); flash('New day — tracker cleared');
    scheduleDailyReset();
  }, midnight - now + 1000);
}

function updateStreak() {
  const today = new Date();
  const start = new Date(2026, 9, 1);
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const day = Math.max(0, Math.floor((utcToday - utcStart) / 86400000) + 1);
  const streak = document.querySelector('#streak-count');
  streak.textContent = `${day}/90`;
  streak.setAttribute('aria-label', `Day ${day} of a 90 day streak`);
}

function createClock() {
  const clock = document.querySelector('#clock');
  for (let n = 1; n <= 12; n++) {
    const number = document.createElement('span');
    number.className = 'clock-number'; number.textContent = n;
    const radians = (n * 30 - 90) * Math.PI / 180;
    number.style.left = `${50 + Math.cos(radians) * 40}%`;
    number.style.top = `${50 + Math.sin(radians) * 40}%`;
    clock.append(number);
  }
  ['hour-hand', 'minute-hand', 'second-hand'].forEach(className => {
    const hand = document.createElement('i'); hand.className = `hand ${className}`; clock.append(hand);
  });
  const center = document.createElement('i'); center.className = 'clock-center'; clock.append(center);
}
function updateClock() {
  const now = new Date(), sec = now.getSeconds(), min = now.getMinutes(), hour = now.getHours() % 12;
  document.querySelector('.hour-hand').style.transform = `rotate(${hour * 30 + min / 2}deg)`;
  document.querySelector('.minute-hand').style.transform = `rotate(${min * 6 + sec / 10}deg)`;
  document.querySelector('.second-hand').style.transform = `rotate(${sec * 6}deg)`;
}
function formatHour(hour) { const normalized = hour % 24, ampm = normalized >= 12 ? 'PM' : 'AM'; return `${normalized % 12 || 12} ${ampm}`; }
function renderTimeline() {
  const timeline = document.querySelector('#timeline'); timeline.innerHTML = '';
  for (let period = 0; period < 8; period++) {
    const firstHour = period * 3;
    const panel = document.createElement('article'); panel.className = 'period';
    panel.innerHTML = `<header class="period-header"><b>${formatHour(firstHour)} – ${formatHour(firstHour + 3)}</b></header>`;
    for (let row = 0; row < 3; row++) {
      const hour = firstHour + row;
      const hourRow = document.createElement('div'); hourRow.className = 'hour';
      hourRow.innerHTML = `<span class="hour-label">${hour % 12 || 12}</span>`;
      for (let quarter = 0; quarter < 4; quarter++) {
        const key = `${hour}-${quarter}`, slot = document.createElement('button');
        const activityName = tracked.get(key), activity = activities.find(a => a.name === activityName);
        slot.className = 'slot'; if (activity) slot.style.background = activity.color;
        slot.title = `${formatHour(hour)}:${String(quarter * 15).padStart(2,'0')}${activity ? ` · ${activity.name}` : ''}`;
        slot.setAttribute('aria-label', slot.title); if (activity) slot.innerHTML = `<span class="slot-symbol">${activity.icon}</span>`;
        slot.dataset.key = key; slot.addEventListener('click', () => setSlot(slot)); hourRow.append(slot);
      }
      panel.append(hourRow);
    }
    timeline.append(panel);
  }
}
function renderPicker() {
  document.querySelector('#activity-options').innerHTML = activities.map(a => `<button class="activity" data-name="${a.name}" style="--activity-color:${a.color}" aria-pressed="${a.name === selected}">${a.icon} ${a.name}</button>`).join('');
  document.querySelectorAll('.activity').forEach(button => button.onclick = () => { selected = button.dataset.name; renderPicker(); persistState(); });
}
function renderSummary() {
  const totals = Object.fromEntries(activities.map(activity => [activity.name, 0]));
  tracked.forEach(name => { if (name) totals[name]++; });
  const formatDuration = slots => `${Math.floor(slots / 4)}h ${String((slots % 4) * 15).padStart(2, '0')}m`;
  const summaryOrder = ['Productive', 'Non-productive', 'Tinkering', 'Daily activities', 'Time waste'];
  document.querySelector('#tag-summary').innerHTML = summaryOrder.map(name => `<div class="tag-total"><span class="tag-total-name">${name}:</span><strong>${formatDuration(totals[name])}</strong></div>`).join('');
}
function setSlot(slot) { const current = tracked.get(slot.dataset.key); tracked.set(slot.dataset.key, current === selected ? '' : selected); renderTimeline(); renderPicker(); renderSummary(); persistState(); flash(current === selected ? 'Block cleared · saved' : `${selected} added · saved`); }
let toastTimer; function flash(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 1500); }
async function initialise() {
  await restoreState();
  createClock(); updateClock(); setInterval(updateClock, 1000);
  updateStreak(); renderPicker(); renderTimeline(); renderSummary(); scheduleDailyReset();
  document.querySelector('#restart').addEventListener('click', () => {
    tracked.clear(); selected = 'Productive';
    persistState(); renderPicker(); renderTimeline(); renderSummary(); flash('Today restarted');
  });
}
initialise();
