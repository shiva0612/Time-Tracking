const activities = [
  { id: 'study', icon: '🔥', name: 'Focus', color: 'var(--study)' },
  { id: 'work', icon: '💼', name: 'Work', color: 'var(--work)' },
  { id: 'waste', icon: '✕', name: 'Time waste', color: 'var(--waste)' },
  { id: 'daily', icon: '☻', name: 'Daily activities', color: 'var(--daily)' },
  { id: 'tinker', icon: '🔧', name: 'Tinkering', color: 'var(--tinker)' },
];
const dailyDetails = [
  { id: 'eating', icon: '🍽️', name: 'Eating' },
  { id: 'bathing', icon: '🛁', name: 'Bathing' },
  { id: 'kids', icon: '🚗', name: 'Kids pickup' },
  { id: 'essential', icon: '✓', name: 'Other essential' },
];
let selected = 'study';
let selectedDetail = 'eating';
let startHour = 18;
const tracked = new Map();
const slotDetails = new Map();
const todoButtons = [...document.querySelectorAll('.todo-markers button')];
function getDayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
let dayKey = getDayKey();

function currentState() {
  return { slots: Object.fromEntries([...tracked].filter(([, activity]) => activity)), details: Object.fromEntries(slotDetails), todos: todoButtons.map(button => button.classList.contains('done')), selected, selectedDetail };
}
function persistState() {
  const state = currentState();
  localStorage.setItem(`timeflow-${dayKey}`, JSON.stringify(state));
}
async function restoreState() {
  const state = JSON.parse(localStorage.getItem(`timeflow-${dayKey}`) || 'null');
  if (!state) return;
  Object.entries(state.slots || {}).forEach(([key, activity]) => tracked.set(key, activity));
  Object.entries(state.details || {}).forEach(([key, detail]) => slotDetails.set(key, detail));
  selected = activities.some(activity => activity.id === state.selected) ? state.selected : selected;
  selectedDetail = dailyDetails.some(detail => detail.id === state.selectedDetail) ? state.selectedDetail : selectedDetail;
  todoButtons.forEach((button, index) => button.classList.toggle('done', Boolean(state.todos?.[index])));
}
function scheduleDailyReset() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  setTimeout(() => {
    dayKey = getDayKey();
    tracked.clear(); selected = 'study'; todoButtons.forEach(button => button.classList.remove('done'));
    renderPicker(); renderTimeline(); renderStats(); flash('New day — tracker cleared');
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
  ['hour-hand','minute-hand','second-hand'].forEach(className => { const hand = document.createElement('i'); hand.className = `hand ${className}`; clock.append(hand); });
  const center = document.createElement('i'); center.className = 'clock-center'; clock.append(center);
}
function updateClock() {
  const now = new Date(), sec = now.getSeconds(), min = now.getMinutes(), hour = now.getHours() % 12;
  document.querySelector('.hour-hand').style.transform = `rotate(${hour * 30 + min / 2}deg)`;
  document.querySelector('.minute-hand').style.transform = `rotate(${min * 6 + sec / 10}deg)`;
  document.querySelector('.second-hand').style.transform = `rotate(${sec * 6}deg)`;
  document.querySelector('#digital-clock').textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}
function formatHour(hour) { const ampm = hour >= 12 ? 'PM' : 'AM'; return `${hour % 12 || 12} ${ampm}`; }
function periodName(hour) {
  if (hour >= 5 && hour < 9) return 'Early morning';
  if (hour >= 9 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 15) return 'Midday';
  if (hour >= 15 && hour < 18) return 'Afternoon';
  if (hour >= 18 && hour < 21) return 'Evening';
  if (hour >= 21) return 'Night';
  if (hour < 3) return 'Midnight';
  return 'Late night';
}
function renderTimeline() {
  document.querySelector('#range-label').textContent = `${formatHour(startHour)} — ${formatHour((startHour + 11) % 24)}`;
  const timeline = document.querySelector('#timeline'); timeline.innerHTML = '';
  for (let period = 0; period < 4; period++) {
    const firstHour = (startHour + period * 3) % 24;
    const panel = document.createElement('article'); panel.className = 'period';
    panel.innerHTML = `<header class="period-header"><b>${periodName(firstHour)}</b><span>${formatHour(firstHour)}</span></header>`;
    for (let row = 0; row < 3; row++) {
      const hour = (firstHour + row) % 24, hourRow = document.createElement('div'); hourRow.className = 'hour';
      hourRow.innerHTML = `<span class="hour-label">${hour % 12 || 12}</span>`;
      for (let quarter = 0; quarter < 4; quarter++) {
        const key = `${hour}-${quarter}`, slot = document.createElement('button');
        const activityId = tracked.get(key), activity = activities.find(a => a.id === activityId);
        slot.className = `slot ${activityId ? `active-${activityId}` : ''}`; slot.title = `${formatHour(hour)}:${String(quarter * 15).padStart(2,'0')}${activity ? ` · ${activity.name}` : ''}`;
        slot.setAttribute('aria-label', slot.title); if (activity) slot.innerHTML = `<span class="slot-symbol">${activity.icon}</span>`;
        slot.dataset.key = key; slot.addEventListener('click', () => setSlot(slot)); hourRow.append(slot);
      } panel.append(hourRow);
    } timeline.append(panel);
  }
}
function setSlot(slot) { const current = tracked.get(slot.dataset.key); tracked.set(slot.dataset.key, current === selected ? '' : selected); renderTimeline(); renderStats(); persistState(); flash(current === selected ? 'Block cleared · saved' : `${activities.find(a => a.id === selected).name} added · saved`); }
function renderPicker() { document.querySelector('#activity-options').innerHTML = activities.map(a => `<button class="activity ${a.id}" data-id="${a.id}" aria-pressed="${a.id === selected}">${a.icon} ${a.name}</button>`).join(''); document.querySelectorAll('.activity').forEach(b => b.onclick = () => { selected = b.dataset.id; renderPicker(); persistState(); }); }
function renderStats() { const values = Object.fromEntries(activities.map(a => [a.id, 0])); [...tracked.values()].forEach(id => { if (id) values[id]++; });
  document.querySelector('#stats-grid').innerHTML = activities.map(a => { const n = values[a.id], hours = `${Math.floor(n/4)}h ${String(n%4*15).padStart(2,'0')}m`; return `<tr><td class="stat-icon">${a.icon}</td><th scope="row" class="stat-name">${a.name}</th><td class="stat-time">${hours}</td></tr>`; }).join(''); }
let toastTimer; function flash(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 1500); }
document.querySelector('#previous').onclick = () => { startHour = (startHour + 12) % 24; renderTimeline(); };
document.querySelector('#next').onclick = () => { startHour = (startHour + 12) % 24; renderTimeline(); };
async function initialise() {
  await restoreState();
  createClock(); updateClock(); updateStreak(); setInterval(updateClock, 1000); renderPicker(); renderTimeline(); renderStats(); scheduleDailyReset();
  todoButtons.forEach(marker => marker.addEventListener('click', () => { marker.classList.toggle('done'); persistState(); }));
  document.querySelector('#restart').addEventListener('click', () => {
    tracked.clear(); selected = 'study'; todoButtons.forEach(marker => marker.classList.remove('done'));
    persistState(); renderPicker(); renderTimeline(); renderStats(); flash('Today restarted');
  });
}
initialise();
