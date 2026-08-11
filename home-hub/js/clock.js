/* ═══════════════════════════════════════
   CLOCK.JS — Live clock, date, greeting
   Pinned to Eastern Time (your area)
   ═══════════════════════════════════════ */

const HUB_TZ = 'America/New_York';   // your area

function clockInit() {
  clockTick();
  HUB.every('clock', clockTick, 1000);
}

function clockTick() {
  const now = new Date();
  // Local hour in Eastern Time (0–23) for the greeting
  const h = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: HUB_TZ, hour: '2-digit', hourCycle: 'h23' }).format(now), 10);

  // Main topbar clock
  const timeStr = now.toLocaleTimeString('en-US', { timeZone: HUB_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { timeZone: HUB_TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const el = document.getElementById('clock');
  if (el) el.textContent = timeStr;
  const de = document.getElementById('date');
  if (de) de.textContent = dateStr;

  // Greeting
  let greeting;
  if (h < 5)  greeting = 'Good night 🌙';
  else if (h < 12) greeting = 'Good morning ☀️';
  else if (h < 17) greeting = 'Good afternoon 🌤';
  else if (h < 21) greeting = 'Good evening 🌆';
  else             greeting = 'Good night 🌙';
  const ge = document.getElementById('greeting');
  if (ge) ge.textContent = greeting;

  // Ambient overlay clock
  const ac = document.getElementById('ambient-time');
  if (ac) ac.textContent = now.toLocaleTimeString('en-US', { timeZone: HUB_TZ, hour: '2-digit', minute: '2-digit', hour12: true });
  const ad = document.getElementById('ambient-date');
  if (ad) ad.textContent = now.toLocaleDateString('en-US', { timeZone: HUB_TZ, weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

  // Pomodoro checks done inside its own setInterval
}
