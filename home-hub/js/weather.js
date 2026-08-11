/* ═══════════════════════════════════════
   WEATHER.JS — Open-Meteo API (free, no key)
   ═══════════════════════════════════════ */

const WMO = {
  0:['Clear Sky','☀️'], 1:['Mainly Clear','🌤️'], 2:['Partly Cloudy','⛅'], 3:['Overcast','☁️'],
  45:['Foggy','🌫️'], 48:['Icy Fog','🌫️'],
  51:['Light Drizzle','🌦️'], 53:['Drizzle','🌧️'], 55:['Heavy Drizzle','🌧️'],
  56:['Freezing Drizzle','🌨️'], 57:['Heavy Freezing Drizzle','🌨️'],
  61:['Light Rain','🌧️'], 63:['Rain','🌧️'], 65:['Heavy Rain','🌧️'],
  66:['Freezing Rain','🌨️'], 67:['Heavy Freezing Rain','🌨️'],
  71:['Light Snow','❄️'], 73:['Snow','❄️'], 75:['Heavy Snow','❄️'], 77:['Snow Grains','🌨️'],
  80:['Light Showers','🌦️'], 81:['Showers','🌦️'], 82:['Heavy Showers','🌧️'],
  85:['Snow Showers','🌨️'], 86:['Heavy Snow Showers','🌨️'],
  95:['Thunderstorm','⛈️'], 96:['Thunderstorm + Hail','⛈️'], 99:['Severe Thunderstorm','⛈️']
};

function wmoInfo(code) { return WMO[code] || ['Unknown','🌡️']; }

let _weatherCache = null, _weatherCacheTime = 0;

async function weatherInit() {
  await weatherFetch();
  HUB.every('weather', weatherFetch, 30 * 60 * 1000); // refresh every 30 min
}

async function weatherFetch() {
  const settings = HUB.get('settings', {});
  const city = settings.weatherCity || 'New York';
  const unit = settings.weatherUnit || 'fahrenheit';

  try {
    // Geocode city
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const geo    = await geoRes.json();
    if (!geo.results?.length) { weatherError('City not found'); return; }

    const { latitude, longitude, name, country_code } = geo.results[0];

    // Fetch weather (current + hourly + 6-day)
    const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&temperature_unit=${unit}&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=6`);
    const w    = await wRes.json();

    _weatherCache = { w, name, country_code, unit };
    _weatherCacheTime = Date.now();
    weatherRender(_weatherCache);
  } catch (e) {
    weatherError('Weather unavailable');
  }
}

// Codes considered "severe" for alerting
const SEVERE_CODES = new Set([56,57,65,66,67,75,77,82,85,86,95,96,99]);

// Build the next-N-hours slice of the hourly forecast starting at the current hour
function _hourlySlice(w, hours = 12) {
  const H = w.hourly;
  if (!H || !H.time) return [];
  const now = Date.now();
  let start = H.time.findIndex(t => new Date(t).getTime() >= now - 3600000); // include current hour
  if (start < 0) start = 0;
  return H.time.slice(start, start + hours).map((t, i) => ({
    time: t,
    temp: H.temperature_2m?.[start + i],
    pop:  H.precipitation_probability?.[start + i],
    code: H.weather_code?.[start + i],
  }));
}

// Decide whether to surface a weather alert banner
function _weatherAlert(w) {
  const cur = w.current;
  const slice = _hourlySlice(w, 12);
  // Severe weather now or upcoming
  if (SEVERE_CODES.has(cur.weather_code)) {
    return { level: 'severe', text: `${wmoInfo(cur.weather_code)[1]} ${wmoInfo(cur.weather_code)[0]} right now — take care.` };
  }
  const severeHour = slice.find(h => SEVERE_CODES.has(h.code));
  if (severeHour) {
    const when = new Date(severeHour.time).toLocaleTimeString('en-US', { hour: 'numeric' });
    return { level: 'severe', text: `${wmoInfo(severeHour.code)[1]} ${wmoInfo(severeHour.code)[0]} expected around ${when}.` };
  }
  // Rain likely soon (next 6h), if not already raining
  const soon = slice.slice(0, 6).find(h => (h.pop ?? 0) >= 50);
  if (soon && (cur.precipitation || 0) === 0) {
    const when = new Date(soon.time).toLocaleTimeString('en-US', { hour: 'numeric' });
    return { level: 'rain', text: `🌧 Rain likely around ${when} (${soon.pop}% chance) — grab an umbrella.` };
  }
  return null;
}

function weatherRender({ w, name, country_code, unit }) {
  const cur  = w.current;
  const daily = w.daily;
  const [desc, icon] = wmoInfo(cur.weather_code);
  const unitSym = unit === 'fahrenheit' ? '°F' : '°C';
  const speedUnit = 'mph';
  const alert = _weatherAlert(w);
  const hourly = _hourlySlice(w, 12);

  // Today's sunrise / sunset (already fetched in the daily block)
  const fmtClock = (iso) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
  const sunrise = fmtClock(daily?.sunrise?.[0]);
  const sunset  = fmtClock(daily?.sunset?.[0]);
  const sunHTML = (sunrise && sunset)
    ? `<div class="weather-detail">🌅 ${sunrise}</div><div class="weather-detail">🌇 ${sunset}</div>`
    : '';

  const alertHTML = alert
    ? `<div class="weather-alert ${alert.level}">${alert.level === 'severe' ? '⚠' : '☔'} ${alert.text}</div>`
    : '';

  const hourlyHTML = hourly.length ? `
    <div class="weather-subhdr">Next hours</div>
    <div class="weather-hourly">
      ${hourly.map((h, i) => {
        const hr = i === 0 ? 'Now' : new Date(h.time).toLocaleTimeString('en-US', { hour: 'numeric' });
        const [, hi] = wmoInfo(h.code);
        return `<div class="hour-cell ${i===0?'now':''}">
          <div class="h-time">${hr}</div>
          <div class="h-icon">${hi}</div>
          <div class="h-temp">${Math.round(h.temp)}°</div>
          ${(h.pop ?? 0) >= 20 ? `<div class="h-pop">💧${h.pop}%</div>` : '<div class="h-pop">&nbsp;</div>'}
        </div>`;
      }).join('')}
    </div>` : '';

  // ─── Home tab weather ───
  const el = document.getElementById('weather-widget');
  if (el) {
    el.innerHTML = `
      ${alertHTML}
      <div class="weather-main">
        <div class="weather-icon-big">${icon}</div>
        <div>
          <div class="weather-temp">${Math.round(cur.temperature_2m)}${unitSym}</div>
          <div class="weather-desc">${desc}</div>
          <div style="font-size:.82rem;color:var(--muted);margin-top:2px;">${name}</div>
        </div>
      </div>
      <div class="weather-details">
        <div class="weather-detail">💧 ${cur.relative_humidity_2m}% humidity</div>
        <div class="weather-detail">🌡 Feels ${Math.round(cur.apparent_temperature)}${unitSym}</div>
        <div class="weather-detail">💨 Wind ${Math.round(cur.wind_speed_10m)} ${speedUnit}</div>
        <div class="weather-detail">🌧 Precip ${cur.precipitation || 0}"</div>
        ${sunHTML}
      </div>
      ${hourlyHTML}
      <div class="weather-subhdr">6-day forecast</div>
      <div class="weather-forecast">
        ${daily.time.slice(1,6).map((date, i) => {
          const [fd, fi] = wmoInfo(daily.weather_code[i+1]);
          const day = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
          const rain = daily.precipitation_probability_max[i+1];
          return `<div class="forecast-day">
            <div class="f-day">${day}</div>
            <div class="f-icon">${fi}</div>
            <div class="f-hi">${Math.round(daily.temperature_2m_max[i+1])}°</div>
            <div class="f-lo">${Math.round(daily.temperature_2m_min[i+1])}°</div>
            ${rain >= 30 ? `<div style="font-size:.68rem;color:var(--accent);margin-top:2px;">💧${rain}%</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    `;
  }

  // ─── Ambient overlay weather ───
  const awi  = document.getElementById('ambient-weather-icon');
  const awt  = document.getElementById('ambient-weather-temp');
  const awd  = document.getElementById('ambient-weather-desc');
  if (awi) awi.textContent = icon;
  if (awt) awt.textContent = Math.round(cur.temperature_2m) + unitSym;
  if (awd) awd.textContent = desc + ' · ' + name;
}

function weatherError(msg) {
  const el = document.getElementById('weather-widget');
  if (el) el.innerHTML = `<div class="empty-state"><div class="es-icon">🌡️</div>${msg}<br><small>Set your city in Settings</small></div>`;
}
