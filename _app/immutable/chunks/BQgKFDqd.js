var e=`// 아스콘.com home. Every number comes from the Supabase \`portal\` read layer
// (site/data.js, unchanged from the sites repository). When a live read fails,
// that section alone falls back to data/home-snapshot.json and says so.
// Order follows the question a visitor brings: price first, then bids, crew, plants.
import {request, allPlants, readStatic, publicEdge} from '../site/data.js';
import {FACTORY_REGIONS} from '../site/factory-data.js';
import {initializeMotion, setMobileMenuOpen, initializeInteractionMotion} from '../site/motion.js';
import {mountHomeMap} from './home-map.js';
import {jobRows, headcount, TEAM_MEANING, REGION_ROW, servedRegions} from '../ui/crew-jobs.js';
import {AI_PICTURE} from '../ui/words.js';
import {OFFICE} from '../ui/office.js';
import {icon} from '../site/ui.js';
import {costCredits} from '../ui/credit.js';
import {CREDITS, creditHtml} from '../ui/credits.js';
import {SURE_TIES, sureGroups} from '../ui/ties.js';

const ORIGINAL = 'https://ascon-information-concept.lossros.chatgpt.site/';
const SUPABASE = 'https://opcjubgjxbmmdzgpsjpi.supabase.co/';
const DAY = 86400000;
const REGION_KEY = 'ascon-home-region';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const num = (value, digits = 0) => Number(value).toLocaleString('ko-KR', {maximumFractionDigits: digits});
const safeUrl = value => /^https:\\/\\/(www\\.)?g2b\\.go\\.kr\\//.test(String(value || '')) ? String(value) : '';
// A source's own title (a notice name, a 조달청 headline) as a link to its page in a new tab, or as plain text when
// there is no address we link to. data-verbatim: the source's words stay as written (WRITING.md §2.3).
// where: the site named for screen readers; attrs: the element's class and title.
const sourceLink = (url, text, where, attrs = '') => url
  ? \`<a\${attrs} data-verbatim href="\${esc(url)}" target="_blank" rel="noopener">\${esc(text)}<span class="h-sr"> (\${where} 새 창)</span></a>\`
  : \`<span\${attrs} data-verbatim>\${esc(text)}</span>\`;
const arrow = value => value > 0 ? '▲' : value < 0 ? '▼' : '';
const tone = value => value > 0 ? 'h-up' : value < 0 ? 'h-down' : 'h-flat';
const pct = (now, before) => finite(now) && finite(before) && before ? (now - before) / before * 100 : null;
// Changes always carry one decimal (「▲35.0%」, not 「▲35%」) so the rows line up and read alike.
const pct1 = value => Number(value).toLocaleString('ko-KR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
// A change in its colour with its arrow: 「▲3.1%」.
const changeTag = (value, tag = 'strong') => \`<\${tag} class="\${tone(value)}">\${arrow(value)}\${pct1(Math.abs(value))}%</\${tag}>\`;
// Against an earlier time: 「지난달보다 ▲3.1%」, or 「지난달과 같아요」 when it rounds to no change.
const versus = (value, when, tag) => Math.abs(value) < 0.05 ? \`\${when}과 같아요\` : \`\${when}보다 \${changeTag(value, tag)}\`;
// Chart paint goes on SVG attributes, colours still from the CSS tokens: the Moli test browser
// skips stylesheet paint on SVG shapes and draws them black.
const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// ---------- Dates (always Korean time) ----------
// Postgres timestamps can carry microseconds, which some Safari versions refuse to parse.
const toDate = value => value instanceof Date ? value : new Date(String(value).replace(/(\\.\\d{3})\\d+/, '$1'));
const time = value => toDate(value).getTime();
const kstParts = new Intl.DateTimeFormat('ko-KR', {timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
function parts(date) {
  const out = {};
  for (const part of kstParts.formatToParts(toDate(date))) out[part.type] = part.value;
  return out;
}
const kstDay = date => { const p = parts(date); return \`\${p.year}-\${p.month.padStart(2, '0')}-\${p.day.padStart(2, '0')}\`; };
// A date from another year names its year, so an old saved copy never reads as this year's.
const dayTime = date => { const p = parts(date), y = parts(new Date()).year === p.year ? '' : \`\${p.year}. \`; return \`\${y}\${p.month}. \${p.day}.(\${p.weekday}) \${p.hour}:\${p.minute}\`; };
const validDate = value => value != null && !Number.isNaN(time(value));
const clock = date => { const p = parts(date); return \`\${p.hour}:\${p.minute}\`; };
// Every day reads 「10. 30.(금)」; another year goes in front (「2025. 9. 28.(일)」).
const shortDay = day => {
  const text = String(day).slice(0, 10);
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(text)) return String(day);
  const [y, m, d] = text.split('-'), weekday = parts(new Date(\`\${text}T12:00:00+09:00\`)).weekday;
  return \`\${y === parts(new Date()).year ? '' : \`\${y}. \`}\${Number(m)}. \${Number(d)}.(\${weekday})\`;
};
const monthLabel = day => { const [y, m] = String(day).split('-'); return \`\${y}년 \${Number(m)}월\`; };
const monthDot = day => { const [y, m] = String(day).split('-'); return \`\${y}. \${Number(m)}.\`; };
const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
// ---------- Motion ----------
// Small, quick, and only where something changed because of a tap: a thumb slides to the chosen
// option, new figures fade in where they stand (figures being read never move). Nothing moves
// for keyboard changes or for people who ask for reduced motion. Values: blueprint/MOTION.md.
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// The PC layout (home.css: 1280px and wider, landscape).
const PC_MEDIA = matchMedia('(min-width: 1280px) and (min-aspect-ratio: 4/3)');
const EASE_OUT = 'cubic-bezier(.23, 1, .32, 1)';
function settle(...nodes) {
  if (calm()) return;
  for (const node of nodes) node?.animate?.([{opacity: .4, filter: 'blur(2px)'}, {opacity: 1, filter: 'blur(0)'}], {duration: 180, easing: EASE_OUT});
}
// A click with detail 0 came from Enter or Space.
const byPointer = event => event.detail !== 0;

// One white thumb under the chosen button of a track (.h-seg, .h-spec-seg). Call the returned
// function after the choice changes; it glides there. Size changes and first showings jump.
function slider(track) {
  const knob = document.createElement('span');
  knob.className = 'h-thumb';
  knob.setAttribute('aria-hidden', 'true');
  track.prepend(knob);
  track.classList.add('has-thumb');
  const place = (glide = true) => {
    const on = track.querySelector(':scope > [aria-selected="true"], :scope > [aria-pressed="true"]');
    if (!on?.offsetWidth) return;
    const jump = !glide || !knob.style.width || calm();
    if (jump) knob.style.transition = 'none';
    knob.style.width = \`\${on.offsetWidth - 6}px\`;
    knob.style.transform = \`translateX(\${on.offsetLeft + 3}px)\`;
    if (jump) { void knob.offsetWidth; knob.style.transition = ''; }
  };
  new ResizeObserver(() => place(false)).observe(track);
  place(false);
  return place;
}

const checkedText = date => kstDay(new Date()) === kstDay(date) ? \`오늘 \${clock(date)}\` : dayTime(date);

function won(value) {
  if (!finite(value) || value <= 0) return '';
  const man = Math.round(value / 1e4);
  if (man < 1) return num(value) + '원';
  if (man < 1e4) return num(man) + '만 원';
  const eok = Math.floor(man / 1e4), rest = man % 1e4;
  return \`\${num(eok)}억\${rest ? ' ' + num(rest) + '만' : ''} 원\`;
}

function remaining(closeAt, now) {
  const ms = time(closeAt) - now.getTime();
  if (!(ms > 0)) return '';
  if (ms < 3600000) return \`\${Math.max(1, Math.floor(ms / 60000))}분 남음\`;
  const days = Math.round((Date.parse(kstDay(closeAt)) - Date.parse(kstDay(now))) / DAY);
  if (days < 1) return \`\${Math.floor(ms / 3600000)}시간 남음\`;
  // The day after tomorrow by name too: on a Saturday a Monday deadline reads 「모레 마감」 (2026-11-01 사장님).
  return days === 1 ? '내일 마감' : days === 2 ? '모레 마감' : \`D-\${days}\`;
}

// ---------- Saved data and section status ----------
let snapshotPending = null;
const snapshot = () => (snapshotPending ||= readStatic('data/home-snapshot.json'));
const savedSections = new Set();
const savedChip = '<span class="h-saved" title="최신 자료를 받지 못해 저장해 둔 자료를 보여 드려요">저장 자료</span>';
const failText = '자료를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.';

async function section(name, live, saved, render, fail) {
  let liveShown = false, savedShown = false;
  const showSaved = async () => {
    // Sections read later than the rest of the snapshot carry their own time (savedAt).
    const snap = await snapshot(), data = saved(snap), at = data?.savedAt || snap.fetchedAt;
    if (liveShown) return;
    render(data, {saved: true, now: toDate(at), at});
    savedSections.add(name);
    savedShown = true;
  };
  // No More Loading: on a slow network the saved copy appears after 2.5 s, marked as saved.
  const early = setTimeout(() => showSaved().catch(() => {}), 2500);
  let data;
  try {
    data = await live();
  } catch (error) {
    clearTimeout(early);
    console.warn(\`[home] \${name}: 최신 자료를 받지 못해 저장 자료를 써요.\`, error);
    if (savedShown) return;
    try { await showSaved(); } catch (snapError) { console.warn(\`[home] \${name}: 저장 자료도 읽지 못했어요.\`, snapError); fail?.(); }
    return;
  }
  clearTimeout(early);
  try {
    render(data, {saved: false, now: new Date()});
    liveShown = true;
    savedSections.delete(name);
  } catch (error) {
    // A live row the page cannot draw is a page bug, not a failed read; the saved copy stands in.
    console.error(\`[home] \${name}: 최신 자료를 그리지 못했어요.\`, error);
    if (!savedShown) try { await showSaved(); } catch { fail?.(); }
  }
}

function fill(selector, html) {
  const node = $(selector);
  if (!node) return;
  node.classList.remove('is-loading');
  node.innerHTML = html;
}

// ---------- 1. Price board ----------
// The four mixes delivered most through the PPS mall, most first (tonnes in portal.ascon_price_daily, which the
// home does not read, so the order is written here). Tapping a row shows that mix on the board; the first is the default.
const SPECS = [['신재 WC-2', '표층', 'WC-2'], ['신재 BB-2', '기층', 'BB-2'], ['순환 BB-2', '순환 기층', 'BB-2'], ['순환 WC-2', '순환 표층', 'WC-2']];
const SPEC_KEY = 'ascon-home-spec';

async function livePrices() {
  const from = new Date();
  from.setUTCDate(1);
  from.setUTCMonth(from.getUTCMonth() - 12);
  const replies = await Promise.all(SPECS.map(([key]) => request('ascon_price_monthly', {select: 'month,sido,median_unit_price', spec_group: 'eq.' + key, delivery_condition: 'eq.공사현장하차도', month: 'gte.' + from.toISOString().slice(0, 10), order: 'month.asc,sido.asc', limit: 1000})));
  if (!replies[0].rows.length) throw new Error('단가 자료가 비어 있어요.');
  return {bySpec: SPECS.map(([key], i) => [key, replies[i].rows]), at: replies[0].retrievedAt};
}
const savedPrices = snap => {
  const {months, specs} = snap.price_history;
  return {
    bySpec: SPECS.map(([key]) => [key, Object.entries(specs[key] || {}).flatMap(([sido, values]) => values.map((median_unit_price, i) => ({month: months[i], sido, median_unit_price})))]),
    at: snap.fetchedAt,
  };
};

let prices = null, region = '', spec = SPECS[0][0];

function priceModel(rows) {
  const months = [...new Set(rows.map(row => row.month))].sort();
  const series = new Map();
  for (const row of rows) {
    if (!row.sido || !finite(row.median_unit_price)) continue;
    if (!series.has(row.sido)) series.set(row.sido, new Map());
    series.get(row.sido).set(row.month, row.median_unit_price);
  }
  const latest = months[months.length - 1];
  const regions = FACTORY_REGIONS.filter(name => series.get(name)?.has(latest));
  const band = months.map(month => {
    const values = regions.map(name => series.get(name).get(month)).filter(finite);
    return values.length ? [Math.min(...values), Math.max(...values)] : null;
  });
  // The national line: the plain average of the regions' medians that month.
  const avg = months.map(month => {
    const values = regions.map(name => series.get(name).get(month)).filter(finite);
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  });
  const back = n => months[months.length - 1 - n];
  return {months, series, regions, latest, band, avg, prev: back(1), yearAgo: back(12)};
}

function renderPrices(data, ctx) {
  prices = {...ctx, at: data.at, bySpec: new Map(data.bySpec.map(([key, rows]) => [key, priceModel(rows)]))};
  // Every 시도, 제주 included: a region without a price still filters bids and deliveries.
  const all = FACTORY_REGIONS;
  const select = $('[data-region]');
  select.innerHTML = '<option value="">전국</option>' + all.map(name => \`<option value="\${esc(name)}">\${esc(name)}</option>\`).join('');
  try { region = localStorage.getItem(REGION_KEY) || ''; spec = localStorage.getItem(SPEC_KEY) || spec; } catch {}
  if (!all.includes(region)) region = '';
  if (!prices.bySpec.get(spec)?.latest) spec = SPECS[0][0];
  select.value = region;
  select.disabled = false;
  // The chosen region also narrows the bids below.
  select.onchange = () => {
    region = select.value;
    try { localStorage.setItem(REGION_KEY, region); } catch {}
    drawPrice();
    drawBids();
    drawSoon();
    drawWeather();
    settle($('[data-price-value]'), $('[data-price-change]'));
  };
  drawPrice();
  drawBids();
  drawSoon();
  markPriceShown();
}

// The board shows six months or a year (the [6개월 | 1년] switch): the same month back then through the
// latest month, so the chart's two ends are the two months the change beside the figure compares.
const PERIOD_KEY = 'ascon-home-period';
let period = 12;
try { period = Number(localStorage.getItem(PERIOD_KEY)) === 6 ? 6 : 12; } catch {}
const periodAgo = () => (period === 6 ? '6개월 전' : '1년 전');
const windowView = m => ({months: m.months.slice(-(period + 1)), band: m.band.slice(-(period + 1)), avg: m.avg.slice(-(period + 1))});
const specName = key => { const found = SPECS.find(([k]) => k === key); return found ? \`\${found[1]} \${found[2]}\` : key; };
const board = () => prices.bySpec.get(spec);

// Each message stays in one piece, so a narrow screen breaks the line between them, not inside one.
const phrases = (...texts) => texts.filter(Boolean).map(text => \`<span class="h-part">\${text}</span>\`).join('<span class="h-sep" aria-hidden="true"> · </span>');

function drawPrice() {
  const m = board(), latestOf = name => m.series.get(name)?.get(m.latest);
  // The figure is the portal's median of 조달청 multiple-award contract prices per region, VAT included.
  $('[data-price-name]').textContent = specLabel(spec);
  // Whose figure it is leads the basis line: the regional average, or the chosen region's median.
  $('[data-price-spec]').innerHTML = phrases(region ? esc(\`\${region} 중앙값\`) : '시도 평균', '톤당 · 현장 하차 · 부가세 포함', region ? '조달청 계약 단가' : '조달청 계약 단가 시도별 중앙값의 평균');
  // One figure (the regional average, or the chosen region) in 만 원; the spread across regions and the
  // year-ago value are labels on the chart, not a range of numbers and a sentence.
  const f = specFigures(spec);
  if (region && !finite(latestOf(region))) {
    fill('[data-price-value]', '–');
    fill('[data-price-change]', \`\${esc(region)}에는 이 규격의 이번 달 단가가 없어요.\`);
  } else {
    // The change sits beside the figure: 「14.7만 원  1년 전보다 ▲39.6%」.
    fill('[data-price-value]', finite(f?.now) ? \`\${man(f.now)}<small>만 원</small>\` : '–');
    fill('[data-price-change]', finite(f?.change) ? \`\${versus(f.change, periodAgo())}\${monthText(f)}\` : '&nbsp;');
  }
  for (const button of document.querySelectorAll('[data-period-months]')) button.setAttribute('aria-pressed', String(Number(button.dataset.periodMonths) === period));
  drawTrend();
  drawPriceStatus();
  drawSpecRows();
}

// The other three mixes beside the chart (PC) or under it (phones): name with its code, this month's
// figure, the year's change and a small line of the same year. Choosing a row puts it on the big chart.
const man = value => (value / 1e4).toFixed(1);
const SPEC_INFO = new Map(SPECS.map(([key, name, code]) => [key, {name, code, material: key.startsWith('순환') ? '순환골재' : '신재'}]));
const specLabel = key => { const s = SPEC_INFO.get(key); return s ? \`\${s.name} · \${s.material} \${s.code}\` : key; };
// Last month's change beside the period change; a flat month says so in words.
const monthText = f => {
  const m = pct(f?.now, f?.line?.at(-2));
  if (m === null) return '';
  return \` · \${versus(m, '지난달')}\`;
};
function specFigures(key) {
  const m = prices.bySpec.get(key);
  if (!m?.latest) return null;
  const view = windowView(m), line = region ? view.months.map(month => m.series.get(region)?.get(month) ?? null) : view.avg;
  const now = line[line.length - 1], before = line.find(finite);
  return {now, change: finite(now) && finite(before) ? pct(now, before) : null, line};
}
function spark(line) {
  const values = line.filter(finite);
  if (values.length < 2) return '';
  const lo = Math.min(...values), hi = Math.max(...values), W = 96, H = 32, n = line.length;
  const y = v => H - 3 - (hi === lo ? (H - 6) / 2 : (v - lo) / (hi - lo) * (H - 6));
  const points = line.map((v, i) => (finite(v) ? \`\${(i / (n - 1) * W).toFixed(1)},\${y(v).toFixed(1)}\` : null)).filter(Boolean).join(' ');
  const last = line[n - 1];
  return \`<svg class="h-spec-spark" viewBox="-4 -4 \${W + 8} \${H + 8}" aria-hidden="true"><polyline points="\${points}" fill="none" stroke="\${token('--brand-300')}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>\${finite(last) ? \`<circle cx="\${W}" cy="\${y(last).toFixed(1)}" r="3.5" fill="\${token('--brand-700')}" stroke="\${token('--surface')}" stroke-width="2"/>\` : ''}</svg>\`;
}
function drawSpecRows() {
  const box = $('[data-spec-rows]');
  if (!box || !prices) return;
  // All four specs stay in place and the one on the chart is marked, so a click never reshuffles the list (PC
  // shows the marked row; tablet and phone hide it and keep three).
  box.innerHTML = SPECS.map(([key]) => {
    const f = specFigures(key), info = SPEC_INFO.get(key), has = finite(f?.now), on = key === spec;
    return \`<button type="button" class="h-spec-row\${on ? ' is-on' : ''}" data-spec-row="\${esc(key)}" aria-pressed="\${on}"\${has ? '' : ' disabled'}>
      <span class="h-spec-row-name">\${esc(info.name)} <small><span class="h-spec-row-mat">\${esc(info.material)} </span>\${esc(info.code)}</small></span>
      <span class="h-spec-row-value">\${has ? \`\${man(f.now)}<small>만 원</small>\` : '<small>이번 달 단가 없음</small>'}</span>
      <span class="h-spec-row-change">\${finite(f?.change) ? versus(f.change, periodAgo(), 'span') : ''}</span>
      \${has ? spark(f.line) : ''}</button>\`;
  }).join('');
}

function drawPriceStatus() {
  if (!prices) return;
  const status = $('[data-price-status]'), latest = board().latest;
  const checked = collected('pps-mas'), month = esc(monthLabel(latest).replace(/^\\d+년 /, ''));
  status.classList.toggle('is-saved', prices.saved);
  status.innerHTML = prices.saved
    ? \`\${savedChip}<span>\${month} 단가 · \${esc(dayTime(prices.at))} 기준</span>\`
    : \`<span class="h-dot" aria-hidden="true"></span><span>\${month} 단가\${checked ? \` · \${esc(checkedText(checked))} 수집\` : ''}</span>\`;
}

let trendScale = {lo: 0, hi: 1};
function drawTrend() {
  const m = {...board(), ...windowView(board())}, plot = $('[data-trend-plot]'), n = m.months.length;
  const line = region && m.series.has(region) ? m.months.map(month => m.series.get(region).get(month) ?? null) : region ? null : m.avg;
  const values = m.band.flatMap(b => b || []).concat(line ? line.filter(finite) : []);
  let lo = Math.min(...values), hi = Math.max(...values);
  const step = [2000, 2500, 5000, 10000, 20000, 25000, 50000].find(s => (hi - lo) / s <= 4) || 100000;
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  if (hi === lo) hi = lo + step;
  const W = 600, H = 200, x = i => n > 1 ? i / (n - 1) * W : W / 2, y = v => H - (v - lo) / (hi - lo) * H;
  const pts = (list, pick) => list.map((v, i) => finite(pick(v)) ? \`\${x(i).toFixed(1)},\${y(pick(v)).toFixed(1)}\` : null).filter(Boolean).join(' ');
  const top = pts(m.band, b => b?.[1]), bottom = m.band.map((b, i) => b ? \`\${x(i).toFixed(1)},\${y(b[0]).toFixed(1)}\` : null).filter(Boolean).reverse().join(' ');
  const ticks = [];
  for (let v = lo; v <= hi + 1; v += step) ticks.push(v);
  const first = m.months[0], last = m.months[n - 1];
  const firstLine = line?.find(finite), lastLine = line?.[n - 1];
  const label = region && !line ? \`\${region}에는 \${spec} 단가 자료가 없어요. 띠는 시도별 범위예요.\`
    : region ? \`\${region} \${spec} 단가: \${monthLabel(first)} \${num(firstLine)}원에서 \${monthLabel(last)} \${num(lastLine)}원\`
    : \`시도별 \${spec} 단가 평균: \${monthLabel(first)} \${num(firstLine)}원에서 \${monthLabel(last)} \${num(lastLine)}원, 범위 \${num(m.band[n - 1]?.[0])}~\${num(m.band[n - 1]?.[1])}원\`;
  // The biggest month-on-month step gets one note (「4월 한 달 ▲3.9만」) when it is 5% or more.
  let jump = null;
  if (line) for (let i = 1; i < n; i++) {
    const a = line[i - 1], b = line[i];
    if (finite(a) && finite(b) && a && Math.abs(b - a) / a >= 0.05 && (!jump || Math.abs(b - a) > Math.abs(jump.step))) jump = {i, step: b - a};
  }
  plot.innerHTML = \`\${ticks.map(v => \`<span class="h-trend-y" style="top:\${(y(v) / H * 100).toFixed(2)}%">\${num(v / 1e4, 1)}만</span>\`).join('')}
    <div class="h-trend-area">\${finite(firstLine) ? \`<span class="h-trend-base" style="top:\${(y(firstLine) / H * 100).toFixed(2)}%" aria-hidden="true"></span>\` : ''}<svg viewBox="0 0 \${W} \${H}" preserveAspectRatio="none" role="img" aria-label="\${esc(label)}">
      \${ticks.map(v => \`<line class="h-trend-grid" x1="0" x2="\${W}" y1="\${y(v).toFixed(1)}" y2="\${y(v).toFixed(1)}" stroke="\${token('--line')}" stroke-width="1" vector-effect="non-scaling-stroke"/>\`).join('')}
      <polygon class="h-trend-band" points="\${top} \${bottom}" fill="\${token('--brand-500')}" fill-opacity=".13"/>
      \${line ? \`<polyline class="h-trend-line" points="\${pts(line, v => v)}" fill="none" stroke="\${token('--brand-700')}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>\` : ''}
    </svg>
    \${jump ? \`<span class="h-trend-note" style="left:\${(x(jump.i) / W * 100).toFixed(2)}%;top:\${(y(line[jump.i]) / H * 100).toFixed(2)}%">\${Number(m.months[jump.i].slice(5, 7))}월 한 달 <b class="\${tone(jump.step)}">\${arrow(jump.step)}\${man(Math.abs(jump.step))}만</b></span>\` : ''}
    \${finite(lastLine) ? \`<span class="h-trend-end" style="left:100%;top:\${(y(lastLine) / H * 100).toFixed(2)}%"></span>\` : ''}
    \${endLabels(m, line, y, H, n)}
    <span class="h-trend-cursor" hidden></span><span class="h-trend-hover" hidden></span><span class="h-trend-tip" hidden></span></div>\`;
  trendScale = {lo, hi};
  // Quarter marks counted back from the latest month; the first mark and each January carry the year.
  const every = plot.clientWidth < 480 ? 6 : 3;
  $('[data-trend-axis]').innerHTML = m.months.map((month, i) => ({month, i})).filter(({i}) => (n - 1 - i) % every === 0)
    .map(({month, i}, k) => \`<span style="left:\${(n > 1 ? i / (n - 1) * 100 : 50).toFixed(2)}%">\${esc(k === 0 || month.slice(5, 7) === '01' ? monthDot(month) : Number(month.slice(5, 7)) + '월')}</span>\`).join('');
  // The same months as a table for screen readers and keyboard users (the chart itself is one image).
  const table = $('[data-trend-table]');
  if (table) table.innerHTML = \`<caption>\${esc(region || '전국')} \${esc(spec)} 월별 단가(원, 톤당)</caption><tr><th scope="col">월</th><th scope="col">\${region ? esc(region) : '시도 평균'}</th>\${region ? '' : '<th scope="col">최저</th><th scope="col">최고</th>'}</tr>\`
    + m.months.map((month, i) => \`<tr><th scope="row">\${esc(monthDot(month))}</th><td>\${finite(line?.[i]) ? num(line[i]) : '–'}</td>\${region ? '' : \`<td>\${finite(m.band[i]?.[0]) ? num(m.band[i][0]) : '–'}</td><td>\${finite(m.band[i]?.[1]) ? num(m.band[i][1]) : '–'}</td>\`}</tr>\`).join('');
  // The line and the band are named by the labels on the chart, so there is no legend;
  // the 조달청 announcements are in the read-out of their month.
  $('[data-trend-caption]').innerHTML = '';
}

// Labels on the chart: the latest highest, average and lowest regions at the right end, the year-ago
// value at the left. Kept 15px apart so they never overlap; positions in % so the chart can stretch.
function endLabels(m, line, y, H, n) {
  const plotH = $('[data-trend-plot]')?.clientHeight || 150, px = v => y(v) / H * plotH;
  const lastBand = m.band[n - 1], lastLine = line?.[n - 1], firstLine = line?.find(finite);
  const at = top => \`\${(Math.max(6, top) / plotH * 100).toFixed(2)}%\`;
  // The region is named only when one region alone holds the end and there is room (not on phones);
  // the read-out names them all.
  const ends = extremes(m, m.months[n - 1]), roomy = !matchMedia('(max-width: 719px)').matches;
  const who = name => (roomy && name && !name.includes(' 외 ') ? \` \${name}\` : '');
  // The start value is the dotted baseline's name, in the same column as the end values (stock-app
  // previous-close line): the gap to the line's end is the change the headline states.
  const items = (region ? [[region, lastLine, 'is-line']] : [[who(ends.high) ? \`최고\${who(ends.high)}\` : roomy ? '시도 최고' : '최고', lastBand?.[1], ''], ['평균', lastLine, 'is-line'], [who(ends.low) ? \`최저\${who(ends.low)}\` : roomy ? '시도 최저' : '최저', lastBand?.[0], '']])
    .concat([[periodAgo(), firstLine, 'is-base']])
    .filter(([, v]) => finite(v)).map(([name, v, kind]) => ({name, v, kind, top: px(v)})).sort((a, b) => a.top - b.top);
  // Kept 15px apart so they never overlap; in % so the chart can stretch.
  for (let i = 1; i < items.length; i++) items[i].top = Math.max(items[i].top, items[i - 1].top + 15);
  const over = items.length ? items[items.length - 1].top - (plotH - 6) : 0;
  if (over > 0) for (let i = items.length - 1; i >= 0; i--) items[i].top = Math.min(items[i].top - over, i < items.length - 1 ? items[i + 1].top - 15 : Infinity);
  return items.map(item => \`<span class="h-trend-label \${item.kind}" style="top:\${at(item.top)}">\${esc(item.name)} <b>\${man(item.v)}만</b></span>\`).join('')
    + (finite(firstLine) ? \`<span class="h-trend-startdot" style="top:\${(px(firstLine) / plotH * 100).toFixed(2)}%" aria-hidden="true"></span>\` : '');
}
// The dearest and cheapest regions in a month ("강원", or "강원 외 2" when several share it).
function extremes(m, month) {
  const rows = m.regions.map(name => [name, m.series.get(name)?.get(month)]).filter(([, v]) => finite(v));
  if (!rows.length) return {high: '', low: ''};
  const name = list => list.length > 1 ? \`\${list[0]} 외 \${list.length - 1}\` : list[0] || '';
  const hi = Math.max(...rows.map(r => r[1])), lo = Math.min(...rows.map(r => r[1]));
  return {high: name(rows.filter(r => r[1] === hi).map(r => r[0])), low: name(rows.filter(r => r[1] === lo).map(r => r[0])), hi, lo};
}

// Pointer read-out on the trend: month, price and the month's ordered tonnes under the finger or cursor.
function setupTrendPointer() {
  const figure = $('[data-trend]'), plot = $('[data-trend-plot]');
  const hide = () => {
    plot.querySelector('.h-trend-cursor')?.setAttribute('hidden', '');
    plot.querySelector('.h-trend-hover')?.setAttribute('hidden', '');
    plot.querySelector('.h-trend-tip')?.setAttribute('hidden', '');
  };
  const show = event => {
    if (!prices) return;
    const area = plot.querySelector('.h-trend-area');
    if (!area) return;
    const m = {...board(), ...windowView(board())}, rect = area.getBoundingClientRect(), n = m.months.length;
    const i = Math.max(0, Math.min(n - 1, Math.round((event.clientX - rect.left) / rect.width * (n - 1))));
    const month = m.months[i], cursor = plot.querySelector('.h-trend-cursor'), tip = plot.querySelector('.h-trend-tip');
    const value = region ? m.series.get(region)?.get(month) : m.avg[i], delivered = volumeAt(month);
    const ends = region ? null : extremes(m, month);
    const text = region ? (finite(value) ? \`<b>\${man(value)}만 원</b> \${esc(region)}\` : '자료 없음') : finite(value) ? \`<b>\${man(value)}만 원</b> 시도 평균\` : '자료 없음';
    const spread = ends?.high ? \`최고 \${esc(ends.high)} \${man(ends.hi)}만 · 최저 \${esc(ends.low)} \${man(ends.lo)}만\` : '';
    const partial = volume && month === volume.month ? ' 집계 중' : '';
    const left = n > 1 ? i / (n - 1) * 100 : 50;
    cursor.style.left = \`\${left}%\`;
    const said = newsIn(month);
    // One fact per line: month, price, orders, then that month's announcement.
    const dot = plot.querySelector('.h-trend-hover');
    if (finite(value)) {
      dot.style.left = \`\${left}%\`;
      dot.style.top = \`\${((1 - (value - trendScale.lo) / (trendScale.hi - trendScale.lo)) * 100).toFixed(2)}%\`;
      dot.removeAttribute('hidden');
    } else dot.setAttribute('hidden', '');
    tip.innerHTML = [\`<span class="h-tip-month">\${esc(monthDot(month))}</span>\`, text, spread,
      finite(delivered) ? esc(\`조달청 납품 주문 \${tons(delivered)}\${partial}\`) : '',
      said.length ? esc(\`아스콘 발표 · \${newsTitle(said[0].title)}\${said.length > 1 ? \` 외 \${said.length - 1}건\` : ''}\`) : '']
      .filter(Boolean).map(line => \`<span class="h-tip-line">\${line}</span>\`).join('');
    cursor.removeAttribute('hidden');
    tip.removeAttribute('hidden');
    // Kept inside the plot (the y labels sit in its first 40px), so it never widens the page.
    tip.style.left = '-36px';
    const x = left / 100 * rect.width, w = tip.offsetWidth;
    tip.style.left = \`\${Math.max(-36, Math.min(rect.width - w, x - w / 2))}px\`;
    tip.style.transform = 'translateY(-100%)';
  };
  figure.addEventListener('pointermove', show);
  // A tap shows the month under the finger and keeps it until the next tap elsewhere.
  figure.addEventListener('pointerdown', show);
  figure.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') hide(); });
  document.addEventListener('pointerdown', event => { if (!figure.contains(event.target)) hide(); });
}

// ---------- 1b. On the chart: 조달청 발표 about asphalt ----------
// Press releases and explanations the portal has already classed as 아스콘·도로포장
// (portal.policy_notice_topics), 공공누리 제1유형 only, so they can be shown with the source named.
// A month with one gets a dot on the chart's floor, the read-out names it, and a recent one sits under the chart.
let news = null;
const safePps = value => /^https:\\/\\/www\\.pps\\.go\\.kr\\//.test(String(value || '')) ? String(value) : '';
// The label already says 조달청, so a title's own leading "조달청," is dropped.
const newsTitle = title => String(title || '').replace(/^\\[보도설명자료\\]\\s*/, '').replace(/^조달청(?:\\s*[,·]\\s*|\\s+)/, '').trim();
async function liveNews() {
  const from = new Date();
  from.setUTCDate(1);
  from.setUTCMonth(from.getUTCMonth() - 13);
  const reply = await request('policy_notices', {select: 'board,title,posted_on,url', topic: 'eq.ascon_paving', kogl_type: 'eq.KOGL-1', posted_on: 'gte.' + from.toISOString().slice(0, 10), order: 'posted_on.desc', limit: 50});
  return {rows: reply.rows};
}
const savedNews = snap => {
  if (!Array.isArray(snap.ascon_news)) throw new Error('아스콘 발표 저장 자료가 없어요.');
  return {rows: snap.ascon_news, savedAt: snap.news_at};
};
function renderNews(data, {saved}) {
  const rows = data.rows.filter(row => /^\\d{4}-\\d{2}-\\d{2}$/.test(String(row.posted_on)) && newsTitle(row.title));
  news = {rows: rows.sort((a, b) => b.posted_on.localeCompare(a.posted_on)), saved};
  if (prices) drawTrend();
  drawNewsLine();
  drawAsconNews();
}
const newsIn = month => news ? news.rows.filter(row => row.posted_on.slice(0, 7) === month.slice(0, 7)) : [];
// Only a recent announcement explains today's price; older ones stay as dots on the chart.
function drawNewsLine() {
  const node = $('[data-price-news]'), latest = news?.rows[0];
  if (!node) return;
  if (!latest || Date.now() - Date.parse(latest.posted_on + 'T00:00:00+09:00') > 120 * DAY) { node.innerHTML = ''; return; }
  node.innerHTML = \`\${news.saved ? savedChip : ''}<span class="h-news-tag">조달청 발표</span><span>\${esc(shortDay(latest.posted_on))}</span>\`
    + sourceLink(safePps(latest.url), newsTitle(latest.title), '조달청');
}

// ---------- 1a. In the chart read-out: tonnes ordered each month ----------
// Every mix, ordered through the PPS mall, by the buyer's region. The current month is still being counted.
let volume = null;
const tons = value => value >= 1e4 ? \`\${num(value / 1e4, 1)}만 톤\` : \`\${num(value)}톤\`;

async function liveVolume() {
  const from = new Date();
  from.setUTCDate(1);
  from.setUTCMonth(from.getUTCMonth() - 13);
  const reply = await request('deliveries_monthly', {select: 'month,sido,qty', unit: 'eq.톤', month: 'gte.' + from.toISOString().slice(0, 10), limit: 1000});
  if (!reply.rows.length || reply.hasMore) throw new Error('납품 물량을 모두 받지 못했어요.');
  const byMonth = new Map();
  for (const row of reply.rows) {
    if (!finite(row.qty)) continue;
    if (!byMonth.has(row.month)) byMonth.set(row.month, new Map());
    const m = byMonth.get(row.month);
    m.set(row.sido, (m.get(row.sido) || 0) + row.qty);
  }
  return {byMonth, at: reply.retrievedAt};
}
const savedVolume = snap => {
  const {months, tons: bySido} = snap.deliveries;
  return {
    byMonth: new Map(months.map((month, i) => [month, new Map(Object.entries(bySido).filter(([, list]) => finite(list[i])).map(([sido, list]) => [sido, list[i]]))])),
    savedAt: snap.deliveries_at,
  };
};
function renderVolume(data, {saved, now}) {
  volume = {...data, saved, month: kstDay(now).slice(0, 8) + '01'};
}

// A region with no orders in a month that was collected delivered 0 tonnes.
function volumeAt(month) {
  const m = volume?.byMonth.get(month);
  if (!m) return null;
  if (region) return m.get(region) || 0;
  let sum = 0;
  for (const value of m.values()) sum += value;
  return sum;
}

// ---------- 1b. In the header: cost inputs ----------
// No 두바이유 until 한국석유공사 approves it in writing: the price is its copy of a paid assessment (Platts), and it
// asks for approval before commercial use (LEGAL.md 2.4 P-02, checked 2026-11-02).
// The header carries only the asphalt and aggregate prices (2026-11-01 사장님 「아스팔트 물가 골재만 헤더에 남겨」), as
// their change from the month before: the index itself (2020=100) reads like a price in 원. Short names so both fit
// the PC header's one line.
const COSTS = ['ppi_asphalt', 'ppi_aggregate'];
const COST_NAMES = {ppi_asphalt: '아스팔트 물가', ppi_aggregate: '골재·석재 물가'};
const COST_SHORT = {ppi_asphalt: '아스팔트', ppi_aggregate: '골재'};
async function liveCosts() {
  const list = \`in.(\${COSTS.join(',')})\`;
  const latest = await request('cost_latest', {select: 'series_id,freq,period,value,change_pct,source_ko,retrieved_on', area: 'is.null', series_id: list, limit: 10});
  if (!latest.rows.length) throw new Error('원가 지표가 비어 있어요.');
  return {latest: latest.rows};
}
const savedCosts = snap => ({latest: snap.cost_latest});

function renderCosts(data, {saved}) {
  const rows = COSTS.map(id => data.latest.find(row => row.series_id === id)).filter(row => row && finite(row.value));
  // The source as ECOS asks, with the day it was read (LEGAL.md P-01), from the rows' own source_ko (ui/credit.js).
  const credit = costCredits(rows, id => COST_NAMES[id], shortDay).map((source, i) => i ? source : \`출처 \${source}\`).join(' · ');
  ticker.source = credit ? \`\${saved ? savedChip : ''}\${esc(credit)}\` : '';
  tickerCosts(rows);
}

function setupSide() {
  $('[data-period]').addEventListener('click', event => {
    const button = event.target.closest('[data-period-months]');
    if (!button || !prices) return;
    period = Number(button.dataset.periodMonths) === 6 ? 6 : 12;
    try { localStorage.setItem(PERIOD_KEY, String(period)); } catch {}
    drawPrice();
  });
  $('[data-spec-rows]').addEventListener('click', event => {
    const button = event.target.closest('[data-spec-row]');
    if (!button || button.disabled || !prices) return;
    spec = button.dataset.specRow;
    try { localStorage.setItem(SPEC_KEY, spec); } catch {}
    drawPrice();
    if (byPointer(event)) settle($('[data-price-value]'), $('[data-price-change]'));
    // The rows were redrawn; keep the keyboard on the chosen row (PC marks it), or on the chart's name where the
    // chosen row is hidden (tablet, phone).
    const row = $(\`[data-spec-row="\${CSS.escape(spec)}"]\`), name = $('[data-price-name]');
    if (row?.offsetParent) row.focus({preventScroll: true}); else if (name) { name.tabIndex = -1; name.focus({preventScroll: true}); }
  });
}

// ---------- 2. Bids (follow the region chosen on the price board) ----------
// Some notices name a merged 시도 (전남광주통합특별시) instead of the regions it was made from; they count for each of
// them. Which regions were merged comes from portal.regions (merged_from) with the bids; without it, none.
let mergedInto = new Map();
const bidSidos = name => !name ? null : mergedInto.has(name) ? [name, mergedInto.get(name)] : [name];
const BID_COLUMNS = 'notice_id,title,agency,sido,sigungu,contract_method,est_price,base_amount,posted_at,close_at,status,boq_ascon_tons,g2b_url';
// PC: the asphalt in the notice's bill of quantities sits under its 추정가격. The base amount stays on the bid
// page, and the contract method shows only when it is not 수의계약 (most notices are, so the word says nothing
// there). R-2026-10-31-bid-card-diet.
const dueFacts = row => finite(row.boq_ascon_tons) && row.boq_ascon_tons > 0 ? \`<p class="h-due-facts">아스콘 \${esc(num(Math.round(row.boq_ascon_tons)))}톤</p>\` : '';
const dueKind = row => row.contract_method && !/수의/.test(row.contract_method) ? \`<span class="h-chip h-due-kind">\${esc(row.contract_method)}</span>\` : '';
const BID_SOURCES = '나라장터·국방전자조달·아파트 단지 포장 공사 공고';
let bids = null;

function tally(rows) {
  const counts = new Map();
  for (const row of rows) counts.set(row.sido, (counts.get(row.sido) || 0) + 1);
  return counts;
}
async function liveBids() {
  const now = new Date(), from = addDays(kstDay(now), -13);
  const [open, calendar, bySido, merged] = await Promise.all([
    request('bids_open', {select: BID_COLUMNS, close_at: 'gt.' + now.toISOString(), order: 'close_at.asc', limit: 500}),
    request('bids_calendar', {select: 'day,new_count,closing_count,opening_count', day: 'gte.' + from, order: 'day.asc', limit: 40}),
    request('bids_calendar_sido', {select: 'day,sido,new_count,closing_count,opening_count', day: 'gte.' + from, order: 'day.asc', limit: 1000}),
    request('regions', {select: 'sido,merged_from', merged_from: 'not.is.null', limit: 50}).then(reply => reply.rows, () => []),
  ]);
  const rows = open.rows.filter(row => row.status !== '취소');
  return {count: rows.length, more: open.hasMore === true, rows, counts: tally(rows), calendar: calendar.rows, calendarSido: bySido.rows, merged, at: open.retrievedAt};
}
const savedBids = snap => ({
  count: snap.bids_open.count,
  more: false,
  rows: snap.bids_open.rows,
  counts: new Map(Object.entries(snap.bids_open.by_sido || {})),
  calendar: snap.bids_calendar,
  calendarSido: (snap.bids_calendar_sido || []).map(([day, sido, new_count, closing_count, opening_count]) => ({day, sido, new_count, closing_count, opening_count})),
  savedAt: snap.bids_at || snap.fetchedAt,
});
function renderBids(data, ctx) {
  bids = {data, ...ctx};
  mergedInto = new Map((data.merged || []).flatMap(row => (Array.isArray(row.merged_from) ? row.merged_from : []).map(part => [part, row.sido])));
  drawBids();
  drawSoon();
  drawWeather();
}

// The region's own calendar: days without a row had no notices there.
function regionCalendar(rows, keys) {
  const byDay = new Map();
  for (const row of rows) {
    if (!keys.includes(row.sido)) continue;
    const day = byDay.get(row.day) || {day: row.day, new_count: 0, closing_count: 0, opening_count: 0};
    for (const key of ['new_count', 'closing_count', 'opening_count']) day[key] += row[key] || 0;
    byDay.set(row.day, day);
  }
  return byDay;
}

// ---------- Phone: the bid cards as one card (home.css, phone block) ----------
// Each source draw hands its figures here; the card draws whatever has arrived.
const phone = {};
const CHEVRON = '<svg class="m-chev" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const bidLines = () => [
  phone.base && {ico: 'money', href: \`\${ORIGINAL}#/bids\`, label: '기초금액 공개', n: phone.base.n, sub: phone.base.sub},
  phone.result && {key: 'result', ico: 'check', href: \`\${ORIGINAL}#/bids\`, label: esc(phone.result.label), n: phone.result.n, sub: phone.result.sub},
  phone.soon && {ico: 'calendar', href: \`\${ORIGINAL}#/bids?tab=planned\`, label: '곧 나올 공사', n: phone.soon.n, sub: '발주계획·조달청 의뢰, 공고 전'},
].filter(Boolean);
// PC: the same lines close the one bid card, and the open new notices' tonnes:
// the key figure of each, the lists on their pages.
function drawDueLines() {
  const list = $('[data-due-lines]');
  const lines = bidLines();
  if (phone.tons) lines.push({ico: 'truck', href: \`\${ORIGINAL}#/market\`, label: '입찰 중인 새 공고 아스콘', n: phone.tons.n, unit: '톤', sub: esc(['최근 7일', phone.tons.top && \`가장 많은 곳 \${phone.tons.top}\`].filter(Boolean).join(' · '))});
  if (list) list.innerHTML = lines.map(line => \`<li><a class="h-link-row" href="\${line.href}"><i class="h-icon">\${icon(line.ico)}</i><span><b>\${line.label}</b>\${line.sub ? \`<small>\${line.sub}</small>\` : ''}</span><span class="h-link-n">\${finite(line.n) ? num(line.n) : '–'}<small>\${line.unit || '건'}</small></span><span aria-hidden="true">→</span></a></li>\`).join('');
  const live = $('[data-due-live]');
  if (live && phone.live) live.innerHTML = \`<span class="h-live\${phone.liveSaved ? ' is-saved' : ''}"><span class="h-dot" aria-hidden="true"></span>\${esc(phone.livePc || phone.live)}</span>\`;
}
function drawPhoneBids() {
  drawDueLines();
  const card = $('[data-m-bids]');
  if (!card || !phone.total) return;
  const {total, live, liveSaved, stats, source, title} = phone;
  $('[data-m-bids-title]').innerHTML = title;
  const chip = $('[data-m-live]');
  chip.classList.toggle('is-saved', liveSaved);
  chip.innerHTML = \`<span class="h-dot" aria-hidden="true"></span>\${esc(live)}\`;
  fill('[data-m-total]', total);
  $('[data-m-today]').innerHTML = stats.map(([label, n, before, note]) => \`<li><a href="\${ORIGINAL}#/bids"><span class="m-today-label">\${label}</span><span class="m-today-value">\${finite(n) ? num(n) : '–'}<small>건</small></span>\${finite(before) ? \`<span class="m-today-sub">어제 \${num(before)}건</span>\` : ''}\${note ? \`<span class="m-today-sub">\${note}</span>\` : ''}</a></li>\`).join('');
  const row = (href, label, n, unit, sub) => \`<li><a class="m-row" href="\${href}"><span class="m-row-text"><span class="m-row-label">\${label}</span>\${sub ? \`<span class="m-row-sub">\${sub}</span>\` : ''}</span><span class="m-row-value">\${finite(n) ? num(n) : '–'}<small>\${unit}</small></span>\${CHEVRON}</a></li>\`;
  $('[data-m-rows]').innerHTML = bidLines().map(line => row(line.href, line.label, line.n, '건', line.sub)).join('');
  $('[data-m-source]').innerHTML = source;
}

// PC: the next two weeks' deadlines as bars from zero on one axis, weekends kept as empty places so the days
// keep their spacing, and the busiest three days in a row named under them with their share of the open notices:
// deadlines bunch, which an average would hide. R-2026-10-31-bid-viz.
function drawDueDays(byDay, today, count) {
  const box = $('[data-due-days]');
  if (!box) return;
  const days = Array.from({length: 14}, (_, i) => addDays(today, i));
  const closing = days.map(day => byDay.get(day)?.closing_count ?? 0), most = Math.max(1, ...closing);
  const three = closing.slice(0, -2).map((n, i) => n + closing[i + 1] + closing[i + 2]);
  const peak = three.indexOf(Math.max(...three)), held = three[peak] || 0;
  const bars = days.map((day, i) => {
    const weekday = parts(new Date(\`\${day}T12:00:00+09:00\`)).weekday, n = closing[i];
    const cls = [day === today && 'is-today', /[토일]/.test(weekday) && 'is-off', i >= peak && i < peak + 3 && held && 'is-peak'].filter(Boolean).join(' ');
    // A bar of 3 against 61 would be under 2px; every day with a deadline keeps at least 3px.
    return \`<li\${cls ? \` class="\${cls}"\` : ''}><span class="h-days-n">\${n ? num(n) : ''}</span><span class="h-days-bar"><span style="height:\${n ? \`max(3px, \${Math.round(n / most * 100)}%)\` : '0'}"></span></span><span class="h-days-d">\${Number(day.slice(8))}<small>(\${weekday})</small></span></li>\`;
  }).join('');
  const share = count ? \`입찰 중의 \${pct1(held / count * 100)}%\` : '';
  const span = held ? \`\${shortDay(days[peak])}~\${shortDay(days[peak + 2])}\` : '';
  const note = held ? \`마감이 가장 몰린 날 \${span} \${num(held)}건\${share ? \` \${share}\` : ''}\` : '앞으로 2주 날짜별 마감';
  box.setAttribute('aria-label', \`\${note}. 앞으로 2주 날짜별 마감 건수, 누르면 입찰정보로 가요.\`);
  box.innerHTML = \`<span class="h-days-note">\${held ? \`<span>마감이 가장 몰린 날</span><b>\${span} \${num(held)}건</b>\${share ? \`<span>\${share}</span>\` : ''}\` : '앞으로 2주 날짜별 마감'}</span><ol>\${bars}</ol>\`;
}

function drawBids() {
  if (!bids) return;
  const {data, saved, now, at} = bids, keys = bidSidos(region), today = kstDay(now);
  const nowMs = Date.now(), open = data.rows.filter(row => !validDate(row.close_at) || time(row.close_at) > nowMs);
  const rows = keys ? open.filter(row => keys.includes(row.sido)) : open;
  const count = keys ? keys.reduce((n, key) => n + (data.counts.get(key) || 0), 0) : data.count;
  const byDay = keys ? regionCalendar(data.calendarSido, keys) : new Map(data.calendar.map(row => [row.day, row]));
  const zero = keys ? 0 : null;

  $('[data-bids-title]').innerHTML = \`입찰 중인 포장 공사\${keys ? \`<span class="h-tile-region">\${esc(region)}</span>\` : ''}\`;
  const live = $('[data-today-live]'), current = !saved && bidsCurrent();
  // A known lag: the collectors answered and one is stale. A failed read is not a lag, and the badge then says nothing
  // (PRINCIPLES D-53: no 「…모름」 on the screen).
  const known = bidRows().length > 0, oldest = lateSince(), lagging = !saved && !current && known;
  const state = saved ? '저장 자료' : current ? '최신' : known ? '수집 지연' : '';
  live.classList.toggle('is-saved', !current);
  live.hidden = !state;
  live.innerHTML = state ? \`<span class="h-dot" aria-hidden="true"></span>\${state}\` : '';
  fill('[data-today-value]', \`\${num(count)}\${data.more && !keys ? '+' : ''}<small>건</small>\${keys ? \`<span class="h-chip">전국 \${num(data.count)}\${data.more ? '+' : ''}건</span>\` : ''}\`);

  // Since the last visit on this device (a visit within 30 minutes counts as the same one).
  const since = $('[data-new-since]');
  if (since) {
    const fresh = visit.base && !saved ? rows.filter(row => validDate(row.posted_at) && time(row.posted_at) > visit.base).length : null;
    since.innerHTML = fresh === null ? '' : \`지난 방문(\${esc(dayTime(new Date(visit.base)))}) 뒤 새 공고 <b>\${num(fresh)}건</b>\`;
  }

  // Saved data names its own day instead of claiming to be today.
  const t = byDay.get(today) || {}, tomorrow = byDay.get(addDays(today, 1)) || {}, yesterday = byDay.get(addDays(today, -1)) || {};
  const d0 = saved ? shortDay(today) : '오늘', d1 = saved ? shortDay(addDays(today, 1)) : '내일';
  // After today's last deadline the count says it is over; a day without deadlines (weekends)
  // gives way to the next day that has them.
  const leftToday = rows.filter(row => validDate(row.close_at) && kstDay(toDate(row.close_at)) === today).length;
  const over = !saved && (t.closing_count || 0) > 0 && !leftToday;
  const next = tomorrow.closing_count ? '' : [...byDay.keys()].filter(day => day > addDays(today, 1) && byDay.get(day).closing_count > 0).sort()[0] || '';
  const stats = [[\`\${d0} 마감\`, t.closing_count ?? zero, null, over ? '끝남' : ''], next ? [\`\${shortDay(next)} 마감\`, byDay.get(next).closing_count] : [\`\${d1} 마감\`, tomorrow.closing_count ?? zero], [\`\${d0} 개찰 예정\`, t.opening_count ?? zero], [\`\${d0} 새 공고\`, t.new_count ?? zero, yesterday.new_count ?? zero]];
  const cells = list => list.map(([label, n, before, note]) => \`<div><a class="h-stat-link" href="\${ORIGINAL}#/bids"><dt>\${label}</dt><dd>\${finite(n) ? num(n) : '–'}<small>건</small>\${finite(before) ? \`<span class="h-chip">어제 \${num(before)}</span>\` : ''}\${note ? \`<span class="h-chip">\${note}</span>\` : ''}</dd></a></div>\`).join('');
  $('[data-today]').innerHTML = cells(stats);
  // PC: the deadline counts head the day groups of the notice list (below), today's new notices sit under
  // the title and today's openings go to the results card.
  const [newLabel, newCount, newBefore] = stats[3];
  $('[data-due-new]').textContent = finite(newCount) ? \`\${newLabel} \${num(newCount)}건\${finite(newBefore) ? \` · 어제 \${num(newBefore)}건\` : ''}\` : '';
  $('[data-due-total]').innerHTML = \`\${keys ? esc(region) + ' ' : ''}입찰 중 \${num(count)}\${data.more && !keys ? '+' : ''}건\`;
  // While the 나라장터 notices lag, today's new notices are not known yet: a dash, not a zero.
  const newLate = !saved && late('g2b-bid-notices');
  $('[data-due-stats]').innerHTML = stats.slice(2).map(([label, n, before, note], i) => \`<li><span>\${label}</span><b>\${finite(n) && !(i === 1 && newLate) ? num(n) : '–'}<small>건</small></b>\${finite(before) ? \`<small>어제 \${num(before)}</small>\` : ''}\${note ? \`<small>\${note}</small>\` : ''}</li>\`).join('');
  drawDueDays(byDay, today, count);
  $('[data-result-plan]').textContent = stats[2][1] > 0 ? \`\${stats[2][0]} \${num(stats[2][1])}건\` : '';
  const merged = keys?.find(key => key !== region) || '';
  const got = collected('g2b-bid-notices');
  const when = saved ? \`\${dayTime(at)} 기준\` : got ? \`\${dayTime(got)} 수집\` : \`\${dayTime(data.at || now)} 조회\`;
  // One source line for every bid card (G-4): where the notices come from, then when they were collected.
  const source = \`\${saved ? savedChip : ''}\${esc(\`\${BID_SOURCES}\${merged ? \` · \${merged} 공고 포함\` : ''} · \${when}\`)}\`;
  for (const node of document.querySelectorAll('[data-today-meta], [data-due-source], [data-flow-source]')) node.innerHTML = source;
  Object.assign(phone, {
    title: \`\${keys ? esc(region) + ' ' : ''}입찰 중인 포장 공사\`,
    total: \`\${num(count)}\${data.more && !keys ? '+' : ''}<small>건</small>\`,
    live: state, liveSaved: !current,
    // PC names the last collection when it lags (「수집 지연 · 10. 30.(금) 19:00」).
    livePc: lagging && oldest ? \`수집 지연 · \${dayTime(oldest)}\` : state,
    // Tomorrow's closings are left to the full list on phones: three counts fit one row.
    stats: [stats[0], stats[2], stats[3]],
    source,
  });
  drawPhoneBids();

  const list = $('[data-due]'), closeDay = row => validDate(row.close_at) ? kstDay(toDate(row.close_at)) : '';
  // PC fills the card with as many notices as fit whole (fitDue). While notices still close today, today's and the
  // next deadline day's take turns in line for the room, so both stay even when few fit (2026-11-01 사장님 「적어도
  // 오늘 내일 마감은 표기해줘야지」, 「없으면 지금처럼 내일마감만 두던가」); the list itself keeps deadline order.
  const todays = rows.filter(row => closeDay(row) === today), later = rows.filter(row => closeDay(row) !== today);
  const line = todays.length ? Array.from({length: Math.min(DUE_MOST, Math.max(todays.length, later.length))}, (_, i) => [todays[i], later[i]]).flat().filter(Boolean) : later;
  const rank = new Map((PC_MEDIA.matches ? line.slice(0, DUE_MOST) : rows.slice(0, 4)).map((row, i) => [row, i]));
  const top = rows.filter(row => rank.has(row));
  // PC: the rows go under their deadline day, and each day's head says how many of that day's notices
  // are shown ("11. 2.(월) 마감 · 26건 중 4건", fitDue keeps it true), so the counts and the list read as one thing.
  const dayHead = day => {
    const total = Math.max(top.filter(row => closeDay(row) === day).length, (day === today && !saved ? leftToday : byDay.get(day)?.closing_count) || 0);
    const label = !day ? '마감일 미정' : \`\${day === today && !saved ? '오늘' : shortDay(day)} 마감\`;
    return \`<li class="h-due-group" data-day="\${esc(day)}" data-label="\${esc(label)}" data-total="\${total}">\${label}</li>\`;
  };
  const todayHead = saved || todays.length ? '' : \`<li class="h-due-group h-due-today">오늘 마감 \${over ? \`\${num(t.closing_count)}건 · 모두 끝났어요\` : '없음'}</li>\`;
  list.innerHTML = top.length ? todayHead + top.map((row, i) => {
    const left = saved ? '' : remaining(row.close_at, now);
    const title = sourceLink(safeUrl(row.g2b_url), row.title, '나라장터', \` class="h-due-title" title="\${esc(row.title)}"\`);
    return \`\${i && closeDay(top[i - 1]) === closeDay(row) ? '' : dayHead(closeDay(row))}<li class="h-due-item" data-day="\${esc(closeDay(row))}" data-rank="\${rank.get(row)}">
      <p class="h-due-top">\${left ? \`<span class="h-chip h-chip-due">\${esc(left)}</span>\` : ''}<span class="h-due-when">\${esc(dayTime(row.close_at))}\${left ? '' : ' 마감'}</span><span class="h-due-where">\${dueKind(row)}\${esc([row.sido, row.sigungu].filter(Boolean).join(' '))}</span></p>
      \${title}
      <span class="h-due-price">\${won(row.est_price) ? \`<small>추정가격</small>\${esc(won(row.est_price))}\` : ''}</span>
      \${dueFacts(row)}
      \${nearLine(row)}
    </li>\`;
  }).join('') : \`<li class="h-empty">\${keys ? esc(region) + '에서 ' : ''}지금 입찰할 수 있는 포장 공사 공고가 없어요.</li>\`;
  loadDueNear(top.filter(row => row.sigungu).map(row => row.notice_id).filter(Boolean));
  drawDueFoot();
  fitDue();
  drawBase();
  drawTons();
  drawNearDefault();
}

// ---------- 2a. Works coming before their bid notice (beside the deadlines) ----------
// Order plans for this month or later and works handed to PPS for tendering, with no notice yet.
let soon = null;
async function liveSoon() {
  const reply = await request('bids_upcoming', {select: 'kind,title,agency,sido,sigungu,amount,expected_period,posted_at,g2b_url', coming: 'is.true', notice_id: 'is.null', withdrawn: 'not.is.true', order: 'amount.desc.nullslast,posted_at.desc', limit: 500});
  return {rows: reply.rows, at: reply.retrievedAt};
}
const savedSoon = snap => {
  if (!Array.isArray(snap.bids_upcoming)) throw new Error('곧 나올 공사 저장 자료가 없어요.');
  return {rows: snap.bids_upcoming, savedAt: snap.bids_at};
};
function renderSoon(data, ctx) {
  // The same work handed over twice shows once.
  const seen = new Set();
  const rows = data.rows.filter(row => { const key = [row.kind, row.title, row.agency, row.amount].join('|'); return (row.kind !== '조달요청' || validDate(row.posted_at)) && !seen.has(key) && seen.add(key); });
  soon = {rows, ...ctx};
  drawSoon();
}
// A share drawn as a bar (0..1): tonnes by region, coming works by amount, bids under the floor rate;
// with a start, a range (tomorrow's low to high on one scale shared by the weather rows).
const bar = (share, from = 0) => {
  const width = Math.max(3, Math.round(share * 100)), left = Math.min(Math.round(from * 100), 100 - width);
  return \`<span class="h-bar" aria-hidden="true"><span style="\${left > 0 ? \`margin-left:\${left}%;\` : ''}width:\${width}%"></span></span>\`;
};
// "55건 중 4건" when the list shows part of the count, "3건" when it shows all of it.
const shareOf = (total, shown) => total > shown ? \`\${num(total)}건 중 \${num(shown)}건\` : \`\${num(shown)}건\`;
// Large amounts read in 억 with one decimal; plan totals can cover more than the paving.
const wonShort = value => finite(value) && value >= 1e8 ? \`\${num(value / 1e8, 1)}억 원\` : won(value);

function drawSoon() {
  if (!soon) return;
  const keys = bidSidos(region), month = kstDay(soon.now).slice(0, 7);
  const rows = keys ? soon.rows.filter(row => keys.includes(row.sido)) : soon.rows;
  soon.shown = rows.length;
  phone.soon = {n: rows.length};
  drawPhoneBids();
  fill('[data-soon-value]', \`\${num(rows.length)}<small>건</small>\`);
  $('[data-soon-head]').textContent = rows.length ? \`금액 큰 순 · \${shareOf(rows.length, Math.min(3, rows.length))}\` : '';
  const most = rows.slice(0, 3).reduce((m, row) => Math.max(m, finite(row.amount) ? row.amount : 0), 0);
  $('[data-soon]').innerHTML = rows.slice(0, 3).map(row => {
    const when = row.kind === '조달요청'
      ? \`조달청 의뢰 \${esc(shortDay(kstDay(row.posted_at)))}\`
      : row.expected_period ? \`\${row.expected_period === month ? '이번 달' : esc(Number(row.expected_period.slice(5, 7)) + '월')} 발주 예정\` : '발주계획';
    const title = sourceLink(safeUrl(row.g2b_url), row.title, '나라장터', \` class="h-due-title" title="\${esc(row.title)}"\`);
    return \`<li class="h-due-item">
      <p class="h-due-top"><span class="h-chip h-chip-plan">\${when}</span><span>· \${esc([row.sido, row.agency].filter(Boolean).join(' · '))}</span></p>
      \${title}
      <span class="h-due-price">\${wonShort(row.amount) ? \`<small>\${row.kind === '조달요청' ? '총공사' : '계획'}</small>\${esc(wonShort(row.amount))}\` : ''}</span>
      \${most && finite(row.amount) ? \`<span class="h-soon-bar">\${bar(row.amount / most)}</span>\` : ''}
    </li>\`;
  }).join('') || \`<li class="h-empty">\${keys ? esc(region) + '에는 ' : ''}입찰공고를 기다리는 포장 공사가 없어요.</li>\`;
  drawDueFoot();
  fitDue();
}

// The note under the toggle and the link at the bottom follow the open tab.
function drawDueFoot() {
  const note = $('[data-due-note]'), soonNote = $('[data-soon-note]'), more = $('[data-due-more]'), place = esc(region || '전국');
  if (soonNote) soonNote.innerHTML = \`\${soon?.saved ? savedChip : ''}공고 전인 발주계획·조달청 의뢰 · <span class="h-pc-off">금액 큰 순 · </span>\${place}\`;
  note.innerHTML = bids?.saved ? \`\${savedChip}\${esc(dayTime(bids.at))} 기준 · 마감된 공고는 뺐어요\` : '';
  if (!bids) return;
  more.innerHTML = \`\${bidSidos(region) ? esc(region) + ' ' : ''}<span class="h-pc-off">공고 모두 보기</span><span class="h-pc-on">입찰정보 전체 보기</span> <span aria-hidden="true">→</span>\`;
}
function setupDue() { drawDueFoot(); }

// ---------- 3. Crew ----------
// No machines for sale on the home: LEGAL.md 7.1.1 finds no machine corner that can be drawn now (A-2, 2026-11-02).
// Counts only. site_public_stats returns the totals and site_public_roster the people per job (counts only since
// 2026-11-02, LEGAL J-04·J-05: no row for a person or a team). Both are read here directly with the same public key.
async function publicRpc(name) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(SUPABASE + 'rest/v1/rpc/' + name, {method: 'POST', body: '{}', signal: ctrl.signal,
      headers: {apikey: window.ASCON_PUBLIC_KEY, 'Content-Type': 'application/json', 'Content-Profile': 'public'}});
    if (!res.ok) throw new Error(\`인력 자료를 받지 못했어요 (\${res.status}).\`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
// Jobs a contractor asks the office for, read the way the 인력 board reads them (../ui/crew-jobs.js: one function,
// one definition). When the office turns roles off for the public (fields.roles) the roster gives no jobs and the
// home shows none. After them the 인력 board's 「갈 수 있는 지역」 row, the groups with someone on the list (servedRegions),
// which only the PC home draws: its crew card grew into the ad place it had under it (PRINCIPLES D-69, fifth exception,
// owner 2026-11-03 「비어있는 광고 자리 홈은 인력 창을 늘려」). Off for the public (fields.region), no row.
const jobCounts = roster => {
  const jobs = roster?.fields?.roles && roster.jobs && typeof roster.jobs === 'object' && !Array.isArray(roster.jobs) ? jobRows(roster.jobs) || [] : [];
  const regions = roster?.fields?.region && !Array.isArray(roster.regions) ? servedRegions(roster.regions).map(([, label]) => label) : [];
  const rows = [...jobs, ...(regions.length ? [[REGION_ROW, regions]] : [])];
  return rows.length ? rows : null;
};
// The live load's job counts (null when the roster fails). They settle on their own so the totals never wait.
let crewJobs = null;
async function liveCrew() {
  // Phones show no job rows, so they never fetch the roster.
  crewJobs = matchMedia('(max-width: 719px)').matches ? null : publicRpc('site_public_roster').then(jobCounts).catch(() => null);
  const stats = await publicRpc('site_public_stats');
  if (!finite(stats?.members)) throw new Error('인력 수가 비어 있어요.');
  return {members: stats.members, teams: stats.teams, equipCrew: stats.equipCrew, asOf: stats.as_of};
}
// A row per kind of work, the jobs by name only (D-61, ../ui/crew-jobs.js). A row that runs out of room lets the jobs at
// its end go to 「+N」, which opens the crew list (2026-10-31 사장님 「짤리면 많은 순서대로만 보여주고」). Without the
// roster (or with roles turned off, or on the saved copy) there are no rows.
function drawJobs(rows) {
  const link = \`\${esc(ORIGINAL)}#/crew\`;
  $('[data-roles]').innerHTML = (rows || []).map(([kind, jobs]) => \`<div class="h-job-row"\${kind === REGION_ROW ? ' data-regions' : ''}><dt>\${esc(kind)}</dt><dd>\${jobs.map(label =>
    \`<a class="h-job" href="\${link}"><span class="h-job-label">\${esc(label)}</span></a>\`).join('')}<a class="h-job-more is-cut" href="\${link}"><span></span><span class="h-sr">개 직무 더 보기</span></a></dd></div>\`).join('');
  fitJobs();
  jobsWatch?.observe($('[data-roles]'));
}
// Each row on one line: the fewest-people jobs at the end step out one by one, counted in 「+N」, until it fits.
function fitJobs() {
  for (const dd of document.querySelectorAll('[data-roles] dd')) {
    const jobs = [...dd.querySelectorAll('.h-job')], more = dd.querySelector('.h-job-more');
    jobs.forEach(job => job.classList.remove('is-cut'));
    more.classList.add('is-cut');
    const oneLine = () => {
      const tops = [...dd.children].filter(child => !child.classList.contains('is-cut')).map(child => child.getBoundingClientRect().top);
      return Math.max(...tops) - Math.min(...tops) < 8;
    };
    for (let cut = 1; cut < jobs.length && !oneLine(); cut++) {
      jobs[jobs.length - cut].classList.add('is-cut');
      more.classList.remove('is-cut');
      more.firstElementChild.textContent = \`+\${cut}\`;
    }
  }
}
// Refit when the card changes width (window, PC/tablet switch) or the web font arrives.
let jobsWidth = 0;
const jobsWatch = typeof ResizeObserver === 'function' ? new ResizeObserver(([entry]) => {
  const width = Math.round(entry.contentRect.width);
  if (width !== jobsWidth) { jobsWidth = width; fitJobs(); }
}) : null;
document.fonts?.ready.then(fitJobs);
// A floored count (D-61, ../ui/crew-jobs.js headcount, the 인력 board's own): under 10, no number.
const counted = (n, unit) => { const h = headcount(n, unit); return h ? \`\${esc(h.text)}<small>\${esc(h.unit)}</small>\` : ''; };
function renderCrew(data, {saved}) {
  fill('[data-crew-value]', counted(data.members));
  // These are the operator's own job-placement roster, not public data. LEGAL J-06: 「인력 명단」 (not 「등록」 until the
  // people on it are known to have applied for work) with the list's own day, the day the office last changed it (as_of), never
  // the fetch time. Beside it the paving teams registered on that day, floored, with their meaning line as the title
  // (PRINCIPLES D-61 addendum: 「기준일에 등록된 포장팀 수예요. …」, the 인력 board's own), and the operators' floored count
  // (D-61).
  const teams = headcount(data.teams, '팀'), operators = headcount(data.equipCrew);
  // Each fact keeps its words on one line and carries the dot that follows it, so a wrapped line never starts with 「·」.
  const facts = ['인력 명단', teams && \`<span data-crew-teams title="\${esc(TEAM_MEANING)}">포장팀 \${esc(teams.text + teams.unit)}</span>\`, operators && \`장비 기사 \${esc(operators.text + operators.unit)}\`, /^\\d{4}-\\d{2}-\\d{2}$/.test(data.asOf || '') && \`\${esc(shortDay(data.asOf))} 기준\`].filter(Boolean);
  $('[data-crew-sub]').innerHTML = (saved ? savedChip : '') + facts.map((fact, i) => \`<span class="h-nowrap">\${fact}\${i < facts.length - 1 ? ' ·' : ''}</span>\`).join(' ');
  $('[data-roles]').innerHTML = '';
  if (saved || !crewJobs) drawJobs(null);
  else crewJobs.then(drawJobs);
}

// The office's names and its legal line (D-60 and its addenda, LEGAL J-09): screens show the brand, and the site footer
// carries the registered trade name, the 직업소개 registration number (예시 until the owner gives it), the business
// number, the phone and the place, on every page (the 1gada.com and 숨고 footer line). One record, ../ui/office.js.
function drawOffice() {
  for (const node of document.querySelectorAll('[data-office]')) if (OFFICE[node.dataset.office]) node.textContent = OFFICE[node.dataset.office];
  const fact = key => (OFFICE.examples.includes(key) ? \`<span data-example><span class="h-chip h-chip-soft">예시</span> \${esc(OFFICE[key])}</span>\` : \`<span data-office="\${key}">\${esc(OFFICE[key])}</span>\`);
  const line = $('[data-office-line]');
  if (line) line.innerHTML = [['상호', 'tradeName'], ['직업소개 등록번호', 'registration'], ['사업자등록번호', 'businessNo'], ['전화', 'phone'], ['위치', 'place']]
    .map(([k, key]) => \`<div><dt>\${k}</dt><dd>\${fact(key)}</dd></div>\`).join('');
}
drawOffice();

// ---------- 5. Ads ----------
// Paid partners, one entry each: {name, line, image, href}. image is a path under assets/ or an https URL.
// None booked yet, so the strip shows the example partners below (each marked 「예시」). With partners the PC
// strip is four places, like the owner's mock (2026-10-31): three partner places, order shuffled on
// every visit so each gets the first place equally, no carousel, then the green enquiry card. A
// place still open shows as an empty dashed place, not a made-up partner. Tablets and phones show the
// first partner and the enquiry card.
const PARTNERS = [];
// Until a partner is booked the strip still shows its four places with example partners, each marked 「예시」
// in its name and line (D-10): the owner's reference page is the full strip (2026-10-31 「이게 맞아 이걸로
// 인식해」; 2026-11-01 「광고 원래 4개잖아」). Real partners in PARTNERS replace them all.
const EXAMPLE_PARTNERS = [
  {name: '예시 업체 A', line: '예시 · 아스콘 생산·납품', image: 'assets/ad-crew.jpg'},
  {name: '예시 업체 B', line: '예시 · 포장 장비 임대', image: 'assets/ad-grading.jpg'},
  {name: '예시 업체 C', line: '예시 · 도로 포장 시공', image: 'assets/ad-paving.jpg'},
];
const CONTACT = ORIGINAL + '#/contact';
// 광고 문의 backgrounds (the owner's 2026-10-20 drive photos plus the first one); one at random per visit,
// never one a partner card on the strip already shows (2026-11-01 사장님 「광고 사진 동일한거 쓰지마」).
const AD_PHOTOS = ['ad-paving', 'ad-grading', 'ad-crew', 'ad-plant'].map(name => \`../assets/\${name}.jpg\`);
const adPhoto = (taken = []) => {
  const free = AD_PHOTOS.filter(src => !taken.includes(src)), pool = free.length ? free : AD_PHOTOS;
  return pool[Math.floor(Math.random() * pool.length)];
};
const safeHref = href => /^https:\\/\\//.test(String(href || '')) ? href : CONTACT;
const safeImage = src => /^(assets\\/[\\w\\-./]+|https:\\/\\/[^\\s"']+)\\.(jpe?g|png|webp)$/i.test(String(src || '')) && !String(src).includes('..') ? src : '';

// The ad pictures are AI-made (the owner's Drive pictures, LEGAL T-01), so each carries LEGAL T-03's mark on the picture
// itself, set off from it and never hidden (T-02, T-03; ../ui/words.js AI_PICTURE). A partner's own picture will carry
// its own mark, so the mark goes with the example partners and the enquiry card's pictures.
const AI_MARK = \`<span class="h-ad-ai" data-ai-label>\${esc(AI_PICTURE.example)}</span>\`;
function drawAds() {
  const slot = $('[data-ad]');
  const booked = PARTNERS.filter(p => p?.name && p?.line), list = booked.length ? booked : [...EXAMPLE_PARTNERS];
  const banner = $('.h-ad-banner .h-ad-photo img');
  if (banner && !banner.parentElement.querySelector('[data-ai-label]')) banner.insertAdjacentHTML('afterend', AI_MARK);
  if (!slot || !list.length) { if (banner) banner.src = adPhoto(); return; }
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  slot.classList.add('is-partners');
  const shown = list.slice(0, 3), open = 3 - shown.length;
  const photo = adPhoto(shown.map(p => safeImage(p.image).replace(/^assets\\//, '../assets/')));
  const empty = \`<a class="h-ad-open" href="\${esc(CONTACT)}"><span class="h-ad-open-title">비어 있는 광고 자리</span><span class="h-ad-open-link">자리 문의 <span aria-hidden="true">→</span></span></a>\`;
  slot.innerHTML = \`<div class="h-ad-partners">\${shown.map(p => {
    const src = safeImage(p.image).replace(/^assets\\//, '../assets/');
    return \`<a class="h-ad-partner" href="\${esc(safeHref(p.href))}" target="_blank" rel="sponsored noopener">
      <span class="h-ad-photo">\${src ? \`<img src="\${esc(src)}" alt="" width="640" height="360" loading="lazy" decoding="async">\${AI_MARK}\` : ''}</span>
      <span class="h-ad-copy"><span class="h-ad-label">광고</span><strong>\${esc(p.name)}</strong><span class="h-ad-text">\${esc(p.line)}</span><span class="h-ad-more">자세히 보기 <span aria-hidden="true">→</span></span></span>
    </a>\`;
  }).join('')}\${empty.repeat(open)}</div>
  <a class="h-ad-ask" href="\${esc(CONTACT)}">
    <span class="h-ad-photo"><img src="\${esc(photo)}" alt="" loading="lazy" decoding="async">\${AI_MARK}</span>
    <span class="h-ad-ask-eyebrow">광고·제휴 문의</span>
    <strong>브랜드를 현장에 연결하세요</strong>
    <span class="h-ad-ask-btn">광고 문의하기 <span aria-hidden="true">→</span></span>
  </a>\`;
}

// ---------- 4. Plants and map ----------
async function loadPlants() {
  // plants has no operating column (operating_confirmed was never there): plant_map says which plants have
  // operating evidence in the last 12 months, and where each map point came from (source_ko, to be shown with the map).
  const [reply, mapRows] = await Promise.all([allPlants(), request('plant_map', {select: 'plant_id,operating,source_ko', limit: 1000}).then(r => r.hasMore ? null : r.rows, () => null)]);
  const rows = reply.rows || [];
  const saved = reply.source !== 'live';
  if (saved) savedSections.add('plants');
  $('[data-plants-total]').textContent = \`\${num(rows.length)}곳\`;
  const month = reply.asOf && /^\\d{4}-\\d{2}/.test(reply.asOf) ? monthLabel(reply.asOf + '-01') + ' 기준' : '';
  const places = [...new Set((mapRows || []).map(row => String(row.source_ko || '').replace(/^출처:\\s*/, '').trim()).filter(Boolean))];
  const placed = places.length ? \`<span class="h-line">공장 위치 <span data-verbatim>\${places.map(esc).join(' · ')}</span></span>\` : '';
  // How many plants are still being checked or have no operating evidence stays off the screen (PRINCIPLES D-53).
  // Tablets and phones read it all in a row; on PC the box opens from 「출처·기준」 (setPlantSourceOpen below).
  const approx = (mapRows || []).filter(row => /기상청/.test(row.source_ko || '')).length;
  const where = mapRows?.length ? \`<span class="h-src-pos">\${POSITION_CREDIT}\${approx ? \`(\${num(approx)}곳은 읍면동 기준점)\` : ''}</span><span class="h-src-sep"> · </span>\` : '';
  $('[data-plants-source]').innerHTML = \`\${saved ? savedChip : ''}\${month}\${month ? '<span class="h-src-sep"> · </span>' : ''}\${where}\`
    // The plant list's sources have no column in portal.plants, so they are named here.
    + \`<span class="h-src-box" id="plants-source-box">산업단지공단·행정안전부·조달청 자료\${placed}<span class="h-hint h-line">시도를 누르면 공장 목록이 열려요</span><span class="h-attr">\${BOUNDARY_CREDIT}</span></span>\`
    + \`<button type="button" class="h-src-btn" aria-expanded="false" aria-controls="plants-source-box">출처·기준</button>\`;
  return rows;
}

// Plant positions (LEGAL S-04): 행정안전부 사업장 points, and 기상청 grid points where a plant has no address point;
// both KOGL type 1, so the words stay in view with a link, not only in the 출처·기준 box.
const POSITION_CREDIT = '공장 위치 <a href="https://www.data.go.kr/data/15154973/openapi.do" target="_blank" rel="noopener">행정안전부</a>·'
  + '<a href="https://www.data.go.kr/data/15084084/openapi.do" target="_blank" rel="noopener">기상청</a>';
// Boundary data terms (home/data/korea-boundaries-LICENSE-DATA.txt): SGIS attribution (KOGL type 1) must stay with
// the data, and the admdongkor derivative is CC BY 4.0. The words are the boards' maps' too (ui/credits.js boundary);
// the desktop map's corner carries their short words with the same links (home-map.js), the phone map does not.
const BOUNDARY_CREDIT = creditHtml(CREDITS.boundary);
// PC map sources box (2026-11-01 사장님 「지도밑에 더 못줄이나? … 메시지 박스?」): under the map one line, the month and
// 「출처·기준」; the sources, what the count takes in and the boundary credit open in a box over the map. The map's
// corner (the module's own credit, in its short words) shows the boundary credit with links all the time, so the
// attribution never leaves the page (KOGL type 1 asks for the source to be shown; CC BY 4.0 3(a)(2) lets the full notice
// sit one link away; review 2026-11-02 259e6ff P1). The button
// opens and closes it, and so do Esc and a click anywhere else.
function setPlantSourceOpen(open, refocus) {
  const source = $('[data-plants-source]'), button = source?.querySelector('.h-src-btn');
  if (!button) return;
  source.classList.toggle('is-open', open);
  button.setAttribute('aria-expanded', String(open));
  if (refocus) button.focus();
}
document.addEventListener('click', event => {
  if (event.target.closest('[data-plants-source] .h-src-btn')) return setPlantSourceOpen(!$('[data-plants-source]').classList.contains('is-open'));
  if (!event.target.closest('.h-src-box')) setPlantSourceOpen(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('[data-plants-source]')?.classList.contains('is-open')) setPlantSourceOpen(false, true);
});

// Weather terms (LEGAL S-03): 「출처: 기상청」 as words with a link to the dataset (KOGL type 1), and the chips
// (비 소식, 5℃ 이하) named as ours, since they are thresholds we put on the forecast (기상청 출처표시 가이드).
const WEATHER_CREDIT = '<a href="https://www.data.go.kr/data/15084084/openapi.do" target="_blank" rel="noopener">출처: 기상청</a> 단기예보(아스콘.com 재가공)';

// ---------- Freshness ----------
let freshRows = null;
const collected = id => { const at = freshRows?.find(row => row.collector_id === id)?.last_success_at; return validDate(at) ? at : null; };
// The bid tile says 최신 while none of its three notice collectors is stale. collectors.stale follows each collector's
// own schedule (국방전자조달 collects four times a day), so the page sets no time limit of its own.
const BID_COLLECTORS = ['g2b-bid-notices', 'dapa-bid-notices', 'kapt-bid-notices'];
const bidRows = () => (freshRows || []).filter(row => BID_COLLECTORS.includes(row.collector_id));
const late = id => bidRows().some(row => row.collector_id === id && row.stale);
// The oldest last success among the stale ones, for the PC chip; null when none is known.
const lateSince = () => bidRows().filter(row => row.stale && validDate(row.last_success_at)).map(row => row.last_success_at).sort((a, b) => time(a) - time(b))[0] || null;
function bidsCurrent() {
  if (!freshRows) return true;
  const list = bidRows();
  return list.length > 0 && list.every(row => !row.stale);
}
async function freshness() {
  try {
    const reply = await request('collectors', {select: 'collector_id,last_success_at,stale', order: 'last_success_at.desc.nullslast', limit: 200});
    freshRows = reply.source === 'live' ? reply.rows : [];
  } catch {
    freshRows = [];
  }
  drawPriceStatus();
  drawBids();
}

// ---------- Menu ----------
// The header is the original site's; open and close its menu the way the original app does
// (map-app.js). initializeInteractionMotion closes it on Escape, an outside tap and resize.
function setupMenu() {
  initializeMotion();
  initializeInteractionMotion(document);
  $('.menu-toggle')?.addEventListener('click', event => {
    const button = event.currentTarget;
    alignFullMenu();
    setMobileMenuOpen($('#mobile-menu'), button, button.getAttribute('aria-expanded') !== 'true');
  });
  addEventListener('resize', alignFullMenu);
  document.fonts?.ready.then(alignFullMenu);
  alignFullMenu();
}
// PC: each 전체 메뉴 group drops straight down from its header menu (2026-11-01 사장님 「헤더 위치에 대응되게
// 내려오게 해」). The grid (home.css .is-aligned) takes where the first menu word starts, the step from one word
// to the next (the menus are evenly spaced) and where the buttons end, measured here so a wider logo, font or
// cost line never puts a group off its menu.
function alignFullMenu() {
  const menu = $('#mobile-menu'), links = [...document.querySelectorAll('.desktop-nav a')], header = $('.site-header'), actions = $('.site-header .header-actions');
  if (!menu || links.length < 2 || !header || !actions) return;
  const on = PC_MEDIA.matches && links[0].getBoundingClientRect().width > 0;
  menu.classList.toggle('is-aligned', on);
  if (!on) return;
  const wordLeft = link => link.getBoundingClientRect().left + parseFloat(getComputedStyle(link).paddingLeft);
  const box = header.getBoundingClientRect();
  menu.style.setProperty('--menu-lead', \`\${wordLeft(links[0]) - box.left}px\`);
  menu.style.setProperty('--menu-col', \`\${wordLeft(links[1]) - wordLeft(links[0])}px\`);
  menu.style.setProperty('--menu-end', \`\${box.right - actions.getBoundingClientRect().right}px\`);
}

// ---------- Start ----------
let markPriceShown = () => {};
const priceShown = new Promise(resolve => { markPriceShown = resolve; setTimeout(resolve, 4000); });
const failList = selector => { const node = $(selector); if (node) node.innerHTML = \`<li class="h-error">\${esc(failText)}</li>\`; };

// ---------- Mockup v2: window height, last visit, header line, results, weather ----------
// The window's size in CSS px for the layout (--pad-x reads the width).
function screenHeight() {
  document.documentElement.style.setProperty('--screen-h', \`\${innerHeight}px\`);
  document.documentElement.style.setProperty('--screen-w', \`\${innerWidth}px\`);
  fitDue();
}
// PC: the bid card keeps its size — the 입찰 진행 card beside it sets the row, the list takes what is left — and shows
// as many notices as fit whole (2026-11-01 사장님 「컨테이너 영역은 유지하면 되잖아」). The ones last in line step
// out first, the first two always stay, and each day's head counts what is left (at most DUE_MOST are lined up).
const DUE_MOST = 8;
function fitDue() {
  const list = $('[data-due]');
  if (!list) return;
  const items = [...list.querySelectorAll('.h-due-item[data-rank]')], heads = [...list.querySelectorAll('.h-due-group[data-day]')];
  list.style.removeProperty('--due-spread');
  for (const li of list.children) li.classList.remove('is-cut');
  // A day's head goes with its last shown notice, and says how many of the day's notices are shown.
  const settle = () => heads.forEach(head => {
    const shown = items.filter(item => item.dataset.day === head.dataset.day && !item.classList.contains('is-cut')).length, total = +head.dataset.total;
    head.classList.toggle('is-cut', !shown);
    head.textContent = \`\${head.dataset.label} · \${total > shown ? \`\${num(total)}건 중 \${num(shown)}건\` : \`\${num(shown)}건\`}\`;
  });
  settle();
  if (!PC_MEDIA.matches) return;
  const bottom = list.getBoundingClientRect().bottom;
  const end = () => Math.max(0, ...[...list.children].filter(li => !li.classList.contains('is-cut')).map(li => li.getBoundingClientRect().bottom));
  for (const item of [...items].sort((a, b) => b.dataset.rank - a.dataset.rank)) {
    if (end() <= bottom + 1 || +item.dataset.rank < 2) break;
    item.classList.add('is-cut');
    settle();
  }
  // A full list leaves less than one notice of room at its foot; the notices shown share it out (at most 24px each), so
  // the card keeps no blank band under its last notice (D-30, B-2 of the 2026-11-02 review).
  const shown = items.filter(item => !item.classList.contains('is-cut')).length, left = bottom - end();
  if (shown && shown < items.length && left > 0) list.style.setProperty('--due-spread', \`\${Math.min(left / shown, 24).toFixed(1)}px\`);
}
document.fonts?.ready.then(fitDue);
const VISIT_KEY = 'ascon-home-visit';
const visit = (() => {
  const now = Date.now();
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(VISIT_KEY) || '{}') || {}; } catch {}
  const base = now - (saved.seen || 0) > 30 * 60000 ? saved.seen : saved.base;
  try { localStorage.setItem(VISIT_KEY, JSON.stringify({base: base || null, seen: now})); } catch {}
  return {base: Number.isFinite(base) ? base : null};
})();

const ticker = {costs: [], source: '', index: 0, paused: calm(), hold: false, timer: 0};
// The monthly bid checks (「알아 두세요」) are not on the home (2026-11-01 사장님 「이런 것도 굳이 홈에 뜨게 할 필요가 있나?」).
const tickerItems = () => ticker.costs;
function drawTicker(step = 0) {
  const items = tickerItems(), node = $('[data-ticker-item]');
  if (!node || !items.length) return;
  ticker.index = (ticker.index + step + items.length) % items.length;
  const item = items[ticker.index];
  // The source line goes with the figures (LEGAL.md P-01): under them on PC, after them elsewhere.
  const source = ticker.source ? \`<span class="h-ticker-src">\${ticker.source}</span>\` : '';
  // PC: every cost at once in the short form; the ones that do not fit the header drop out whole.
  if (PC_MEDIA.matches) { node.innerHTML = \`<span class="h-ticker-kind">원가</span><span class="h-ticker-stack"><span class="h-ticker-list">\${ticker.costs.map(cost => cost.short).join('')}</span>\${source}</span>\`; return; }
  node.innerHTML = \`<span class="h-ticker-kind">\${esc(item.kind)}</span><span class="h-ticker-text">\${item.html}</span>\${source}\`;
  $('[data-ticker-count]').textContent = \`\${ticker.index + 1}/\${items.length}\`;
  if (step) settle(node);
}
function setupTicker() {
  const band = $('[data-ticker]');
  if (!band) return;
  const wide = PC_MEDIA, home = band.nextElementSibling;
  const place = () => { if (wide.matches) $('.site-header .header-actions')?.before(band); else home.before(band); };
  wide.addEventListener('change', place);
  place();
  for (const [type, hold] of [['pointerenter', true], ['pointerleave', false], ['focusin', true], ['focusout', false]]) band.addEventListener(type, () => { ticker.hold = hold; });
  wide.addEventListener('change', () => drawTicker());
  ticker.timer = setInterval(() => { if (!PC_MEDIA.matches && !ticker.paused && !ticker.hold && !document.hidden) drawTicker(1); }, 5000);
}
function tickerCosts(rows) {
  // Each index as its change from the period before (「아스팔트 지난달보다 ▲3.1%」); a row without one is left out.
  ticker.costs = rows.filter(row => finite(row.change_pct)).map(row => {
    const daily = row.freq === 'D', when = daily ? shortDay(row.period) : monthLabel(row.period), before = daily ? '전날' : '지난달';
    const short = \`<span class="h-ticker-cost" title="\${esc(when)}">\${esc(COST_SHORT[row.series_id] || COST_NAMES[row.series_id])} \${versus(row.change_pct, before, 'span')}<span class="h-sr"> \${esc(when)}</span></span>\`;
    return {kind: '원가', short, html: \`\${esc(COST_NAMES[row.series_id])} \${versus(row.change_pct, before, 'span')}<span class="h-ticker-when">\${esc(when)}</span>\`};
  });
  drawTicker();
}
// The news card leads with the last two weeks of releases (R-2026-10-31-row1-row4). The latest asphalt
// announcement stays on the card whatever its age, since a measure can run for months, and its head says so
// (「가장 최근 글」); once older than the window it moves below the recent releases, so the card still opens on news.
const NEWS_DAYS = 14;
const newsSince = () => addDays(kstDay(new Date()), -NEWS_DAYS);
async function livePps() {
  const reply = await request('policy_notices', {select: 'board,title,posted_on,url,topic', kogl_type: 'eq.KOGL-1', posted_on: 'gte.' + newsSince(), order: 'posted_on.desc', limit: 300});
  return {rows: reply.rows};
}
function renderPps(data) {
  // 아스콘 announcements stay on the price chart; the header line carries the other press releases.
  const paving = new Set(data.rows.filter(row => row.topic === 'ascon_paving').map(row => row.url)), seen = new Set();
  // Only what a paving bidder can act on; a weekly or monthly series shows its latest issue once.
  const series = new Set();
  const rows = data.rows.filter(row => {
    const title = newsTitle(row.title), key = title.replace(/\\(.*?\\)/g, '').replace(/[\\d\\s,.'’~·]+/g, '');
    return !paving.has(row.url) && /^(보도자료|보도설명)$/.test(row.board) && title && PPS_KEEP.test(title) && !PPS_SKIP.test(title)
      && !seen.has(row.url) && seen.add(row.url) && !series.has(key) && series.add(key);
  });
  $('[data-news-pps]').innerHTML = newsItems(rows.slice(0, 3)) || '<li class="h-empty">최근 2주 공사 입찰·계약 관련 보도자료가 없어요.</li>';
}

async function liveResults() {
  const reply = await request('results', {select: 'opened_at,title,g2b_url,participants,outcome', opened_at: 'gte.' + addDays(kstDay(new Date()), -7) + 'T00:00:00+09:00', order: 'opened_at.desc', limit: 1000});
  return {rows: reply.rows};
}
function renderResults(data) {
  const day = data.rows.map(row => kstDay(toDate(row.opened_at))).sort().at(-1);
  if (!day) return;
  const rows = data.rows.filter(row => kstDay(toDate(row.opened_at)) === day);
  // No 1순위 투찰률 and no share of bids under the floor: both come from the 나라장터 screen ranking (LEGAL.md 3,
  // U-04, verified 2026-11-02), so they stay off until they are read from the official API. No 「보통 N곳 참가」
  // either: one figure for a day of mixed contract methods reads like a forecast (PRINCIPLES §7.4, D-35).
  const rebid = rows.filter(row => /유찰|재입찰/.test(String(row.outcome || ''))).length;
  $('[data-result-day]').textContent = shortDay(day);
  const today = kstDay(new Date());
  $('[data-result-title]').textContent = day === today ? '오늘 개찰 결과' : day === addDays(today, -1) ? '어제 개찰 결과' : \`\${shortDay(day)} 개찰 결과\`;
  fill('[data-result-value]', \`\${num(rows.length)}<small>건</small>\`);
  $('[data-result-total]').textContent = \`\${num(rows.length)}건\`;
  phone.result = {n: rows.length, label: $('[data-result-title]').textContent, sub: esc(\`유찰·재입찰 \${num(rebid)}건\`)};
  drawPhoneBids();
  // The three notices with the most bidders: name, count and the stage the source gives.
  const top = rows.filter(row => finite(row.participants) && row.title).sort((a, b) => b.participants - a.participants).slice(0, 5);
  $('[data-result-top-head]').hidden = !top.length;
  $('[data-result-top]').innerHTML = top.map(row => {
    return \`<li class="h-result-top-item">\${sourceLink(safeUrl(row.g2b_url), row.title, '나라장터')}<span class="h-result-top-n">\${num(row.participants)}곳\${row.outcome ? \` · <span data-verbatim>\${esc(row.outcome)}</span>\` : ''}</span></li>\`;
  }).join('');
  const topShown = [...$('[data-result-top]').children].filter(li => getComputedStyle(li).display !== 'none').length;
  $('[data-result-top-count]').textContent = top.length ? \` · \${shareOf(rows.length, topShown)}\` : '';
  $('[data-result-stats]').innerHTML = \`<div><dt>유찰·재입찰</dt><dd>\${num(rebid)}<small>건</small></dd></div>\`;
}

// Tomorrow's paving weather: the chosen region, or the regions with the most open bids, as many as fill the card
// (WEATHER_PLACES; B-2 of the 2026-11-02 review). The Edge function keeps each answer in memory until the next
// forecast issue, so a fifth region adds few calls to the 기상청 service.
const WEATHER_PLACES = 5;
const SIDO_POINT = {서울: [37.5665, 126.978], 부산: [35.1796, 129.0756], 대구: [35.8714, 128.6014], 인천: [37.4563, 126.7052], 광주: [35.1595, 126.8526], 대전: [36.3504, 127.3845], 울산: [35.5384, 129.3114], 세종: [36.48, 127.289], 경기: [37.4138, 127.5183], 강원: [37.8228, 128.1555], 충북: [36.6357, 127.4917], 충남: [36.5184, 126.8], 전북: [35.7175, 127.153], 전남: [34.8679, 126.991], 경북: [36.4919, 128.8889], 경남: [35.4606, 128.2132], 제주: [33.4996, 126.5312]};
const forecasts = new Map();
const forecast = name => {
  if (!forecasts.has(name)) forecasts.set(name, publicEdge('weather-forecast', {lat: SIDO_POINT[name][0], lon: SIDO_POINT[name][1]}).catch(error => { forecasts.delete(name); throw error; }));
  return forecasts.get(name);
};
function workday(data, day) {
  // Working hours 08–17: rain if any hour has rain or 60%+ chance; cold if any hour is 5℃ or lower
  // (국토부 「아스팔트 콘크리트 포장 시공 지침」 2024. 7. 5.5(2): 대기온도가 5 ℃ 이하이면 시공하지 않는다).
  const hours = (data.hours || []).filter(h => h.at.startsWith(day) && +h.at.slice(11, 13) >= 8 && +h.at.slice(11, 13) <= 17);
  const temps = hours.map(h => h.values?.TMP?.value).filter(finite), pops = hours.map(h => h.values?.POP?.value).filter(finite);
  const rain = hours.some(h => (h.values?.PTY?.code || 0) > 0) || Math.max(0, ...pops) >= 60;
  const skies = hours.map(h => h.values?.SKY?.label).filter(Boolean), sky = skies.sort((a, b) => skies.filter(s => s === b).length - skies.filter(s => s === a).length)[0] || '';
  const daily = (data.days || []).find(d => d.date === day)?.values || {};
  const slots = hours.map(h => ({hour: +h.at.slice(11, 13), temp: h.values?.TMP?.value, rain: (h.values?.PTY?.code || 0) > 0 || (h.values?.POP?.value ?? 0) >= 60}))
    .map(s => ({...s, cold: finite(s.temp) && s.temp <= 5})).sort((a, b) => a.hour - b.hour);
  return {slots, rain, cold: temps.length ? Math.min(...temps) <= 5 : false, sky, pop: pops.length ? Math.max(...pops) : null, low: daily.TMN?.value, high: daily.TMX?.value, issue: data.issue?.at};
}
const WORK_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
// Hours 8, 9, 10, 15 read 「8~10시, 15시」.
const hourSpans = hours => hours.reduce((runs, h) => { const last = runs.at(-1); if (last && h === last[1] + 1) last[1] = h; else runs.push([h, h]); return runs; }, [])
  .map(([a, b]) => a === b ? \`\${a}시\` : \`\${a}~\${b}시\`).join(', ');
// The phone home has no weather card (home.css), so the forecasts are not fetched there.
const PHONE_MEDIA = matchMedia('(max-width: 719px)');
PHONE_MEDIA.addEventListener?.('change', () => { if (!PHONE_MEDIA.matches) drawWeather(); });
async function drawWeather() {
  const list = $('[data-weather]');
  if (!list || PHONE_MEDIA.matches) return;
  const tomorrow = addDays(kstDay(new Date()), 1);
  let names = region && SIDO_POINT[region] ? [region] : null;
  if (!names) {
    const counts = bids?.data?.counts;
    names = counts ? [...counts.entries()].filter(([name]) => SIDO_POINT[name]).sort((a, b) => b[1] - a[1]).slice(0, WEATHER_PLACES).map(([name]) => name) : ['경기', '경북', '전남', '경남'];
  }
  $('[data-weather-day]').textContent = shortDay(tomorrow);
  const results = await Promise.allSettled(names.map(forecast));
  const rows = results.map((r, i) => r.status === 'fulfilled' ? {name: names[i], ...workday(r.value, tomorrow)} : null).filter(Boolean);
  if (!rows.length) { list.innerHTML = '<li class="h-empty">예보를 불러오지 못했어요.</li>'; return; }
  const lows = rows.map(row => row.low).filter(finite), highs = rows.map(row => row.high).filter(finite);
  const floor = Math.min(...lows, ...highs), span = Math.max(...lows, ...highs) - floor;
  const range = row => finite(row.low) && finite(row.high) && span > 0 ? \`<span class="h-weather-range">\${bar((row.high - row.low) / span, (row.low - floor) / span)}</span>\` : '';
  // PC: the working day 8 to 17 as the site's own bar — green where no rain is forecast, left pale where it is, and
  // striped over either where it is 5℃ or lower — under one hour scale and key at the head of the list.
  const when = (row, key) => hourSpans(row.slots?.filter(s => s[key]).map(s => s.hour) || []);
  const slots = row => {
    if (!row.slots?.length) return '<span class="h-weather-slots is-empty"></span>';
    const at = new Map(row.slots.map(s => [s.hour, s]));
    const missing = hourSpans(WORK_HOURS.filter(h => !at.has(h)));
    const said = [['비', when(row, 'rain')], ['5℃ 이하', when(row, 'cold')]].filter(([, t]) => t).map(([w, t]) => \`\${w} \${t}\`).join(', ') || '비와 5℃ 이하 없음';
    return \`<span class="h-weather-slots" role="img" aria-label="\${esc(\`작업 시간 8~17시: \${said}\${missing ? \`, 예보 없음 \${missing}\` : ''}\`)}">\${WORK_HOURS.map(h => {
      const s = at.get(h);
      return \`<i class="\${!s ? 'is-none' : [s.rain && 'is-rain', s.cold && 'is-cold'].filter(Boolean).join(' ')}" title="\${h}시\${s && finite(s.temp) ? \` \${num(s.temp)}℃\` : ''}\${s?.rain ? ' · 비' : ''}\${s?.cold ? ' · 5℃ 이하' : ''}"></i>\`;
    }).join('')}</span>\`;
  };
  const axis = rows.some(row => row.slots?.length)
    ? '<li class="h-weather-axis" aria-hidden="true"><span></span><span class="h-weather-key"><i></i>비 없음<i class="is-cold"></i>5℃ 이하</span><span class="h-weather-hours"><span>8시</span><span>12시</span><span>17시</span></span><span></span></li>'
    : '';
  list.innerHTML = rows.map(row => \`<li class="h-weather-row">
    <span class="h-weather-place">\${esc(row.name)}</span>
    <span class="h-weather-sky\${row.rain || row.cold ? ' has-chip' : ''}">\${row.rain ? '<span class="h-chip h-chip-rain">비<span class="h-chip-more">\\u00a0소식</span></span> ' : ''}\${row.cold ? '<span class="h-chip h-chip-cold">5℃ 이하</span> ' : ''}\${row.rain || row.cold ? '' : esc(row.sky)}\${finite(row.pop) ? \` <small>강수 \${num(row.pop)}%</small>\` : ''}</span>
    \${slots(row)}
    <span class="h-weather-temp">\${finite(row.low) ? num(row.low) : '–'}<span class="h-weather-tilde">~</span>\${range(row)}\${finite(row.high) ? num(row.high) : '–'}<small>℃</small></span>
  </li>\`).join('');
  if (axis) list.insertAdjacentHTML('afterbegin', axis);
  const issue = rows.find(row => row.issue)?.issue;
  $('[data-weather-source]').innerHTML = \`\${WEATHER_CREDIT}\${issue ? \` · \${esc(dayTime(toDate(issue)))} 발표\` : ''} · \${region ? '시도 중심' : '공고 많은 시도'}\`;
}

// 조달청 news worth a paving bidder's time: construction tenders, contract rules, materials prices.
// Goods and service tenders, innovative products, overseas markets and events (visits, ceremonies, awards) stay out.
const PPS_KEEP = /시설공사|공공공사|공사대금|시설자재|입찰자격|입찰보증금|페이퍼컴퍼니|계약이행능력|무분별한 입찰|낙찰|적격심사|종합심사|하한율|대형사업 총|아스콘|아스팔트|레미콘|도로|포장|복구/;
const PPS_SKIP = /용역|물품|혁신제품|우수제품|해외|국제기구|군수품|설계공모|건축|AI|인공지능|학회|포럼|세미나|간담회|특강|교육|방문|찾아|찾은|협약|포상|수상|기념식|캠페인|청렴|채용/;
// One row of the news card: date, then the title as a link to the 조달청 page. Titles, like notice
// names, are the source's own words: data-verbatim keeps them out of the copy check (WRITING.md §4).
function newsItems(rows) {
  return rows.map(row => {
    const title = newsTitle(row.title);
    return \`<li class="h-news-item"><span class="h-news-date">\${esc(shortDay(row.posted_on))}</span>\${sourceLink(safePps(row.url), title, '조달청', \` class="h-news-title" title="\${esc(title)}"\`)}</li>\`;
  }).join('');
}
function drawAsconNews() {
  const node = $('[data-news-ascon]'), pps = $('[data-news-pps]');
  if (!node || !news) return;
  node.innerHTML = (news.saved ? \`<li class="h-news-item">\${savedChip}</li>\` : '') + (newsItems(news.rows.slice(0, 1)) || '<li class="h-empty">최근 1년 아스콘 관련 발표가 없어요.</li>');
  const latest = news.rows[0]?.posted_on, head = node.previousElementSibling;
  if (latest && String(latest) >= newsSince()) pps.previousElementSibling.before(head, node);
  else pps.after(head, node);
}

// ---------- 4. Every day: base amounts published, tonnes in new notices ----------
// 기초금액: bidders work out their bid from it, so the day it is published is the day they come back.
let base = null;
async function liveBase() {
  const reply = await request('bid_base_amounts', {select: 'notice_id,input_at,base_amount,prange_lo_pct,prange_hi_pct', input_at: 'gte.' + addDays(kstDay(new Date()), -4) + 'T00:00:00+09:00', order: 'input_at.desc', limit: 1000});
  return {rows: reply.rows};
}
function renderBase(data, ctx) { base = {...data, ...ctx}; drawBase(); }
const eok = value => !finite(value) ? '' : value >= 1e8 ? \`\${num(value / 1e8, 2)}억 원\` : \`\${num(Math.round(value / 1e4))}만 원\`;
function drawBase() {
  if (!base || !bids) return;
  const keys = bidSidos(region), open = new Map(bids.data.rows.filter(row => row.notice_id && (!keys || keys.includes(row.sido))).map(row => [row.notice_id, row]));
  const latest = new Map();
  for (const row of base.rows) if (open.has(row.notice_id) && !latest.has(row.notice_id)) latest.set(row.notice_id, row);
  const today = kstDay(new Date()), day = [...latest.values()].map(row => kstDay(toDate(row.input_at))).sort().at(-1);
  const rows = [...latest.values()].filter(row => kstDay(toDate(row.input_at)) === day).map(row => ({...row, bid: open.get(row.notice_id)})).sort((a, b) => time(b.input_at) - time(a.input_at));
  $('[data-base-day]').textContent = day ? (day === today ? '오늘' : shortDay(day)) : '';
  const hour = rows.filter(row => Date.now() - time(row.input_at) <= 3600000).length;
  $('[data-base-note]').textContent = rows.length ? \`\${dayTime(toDate(rows[0].input_at))} 마지막 공개\${day === today && hour ? \` · 지난 1시간 \${num(hour)}건\` : ''}\` : '';
  fill('[data-base-value]', \`\${num(rows.length)}<small>건</small>\`);
  phone.base = {n: rows.length, sub: rows.length ? esc(\`\${day === today ? '오늘' : shortDay(day)} 마지막 \${dayTime(toDate(rows[0].input_at)).replace(/^.*\\) /, '')} 공개\`) : ''};
  drawPhoneBids();
  $('[data-base-list]').innerHTML = rows.slice(0, 8).map(row => {
    const range = finite(row.prange_hi_pct) ? \` · 예가 ±\${num(row.prange_hi_pct)}%\` : '';
    const at = dayTime(toDate(row.input_at)).replace(/^.*\\) /, '');
    return \`<li class="h-base-item"><span class="h-base-time">\${esc(at)}</span>\${sourceLink(safeUrl(row.bid.g2b_url), row.bid.title, '나라장터', ' class="h-base-title"')}<span class="h-base-amount">\${esc(eok(row.base_amount))}</span><span class="h-base-sub"><span class="h-pc-off">\${esc(at)} 공개 · </span>\${esc(dayTime(row.bid.close_at))} 마감 · \${esc([row.bid.sido, row.bid.sigungu].filter(Boolean).join(' '))}\${range}</span></li>\`;
  }).join('') || \`<li class="h-empty">\${keys ? esc(region) + '에서 ' : ''}최근 기초금액이 나온 입찰 중 공고가 없어요.</li>\`;
  // The head counts the rows the layout shows (tablets five, PC more; see the CSS).
  const shown = [...$('[data-base-list]').children].filter(li => li.classList.contains('h-base-item') && getComputedStyle(li).display !== 'none').length;
  $('[data-base-head]').textContent = rows.length ? \`새로 나온 순 · \${shareOf(rows.length, shown)}\` : '';
}
// Tonnes of asphalt concrete in the bill of quantities of the notices posted in the last 7 days that are still open
// (bids holds open notices only, so ones already closed are not counted): the plants' demand.
function drawTons() {
  if (!bids) return;
  const keys = bidSidos(region), since = Date.now() - 7 * DAY;
  const rows = bids.data.rows.filter(row => (!keys || keys.includes(row.sido)) && validDate(row.posted_at) && time(row.posted_at) >= since);
  const withTons = rows.filter(row => finite(row.boq_ascon_tons) && row.boq_ascon_tons > 0);
  const total = withTons.reduce((n, row) => n + row.boq_ascon_tons, 0);
  const by = new Map();
  for (const row of withTons) { const key = keys ? (row.sigungu || row.sido) : row.sido; by.set(key, (by.get(key) || 0) + row.boq_ascon_tons); }
  const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8), max = top[0]?.[1] || 1;
  fill('[data-tons-value]', \`\${num(Math.round(total))}<small>톤</small><span class="h-chip">내역서 \${num(withTons.length)}건 합계</span>\`);
  $('[data-tons-head]').textContent = withTons.length ? \`합계 \${num(Math.round(total))}톤 · 내역서 \${num(withTons.length)}건\` : '';
  $('[data-tons-list]').innerHTML = top.map(([name, t]) => \`<li class="h-tons-row"><span class="h-tons-name">\${esc(name)}</span>\${bar(t / max)}<span class="h-tons-num">\${num(Math.round(t))}<small>톤</small></span></li>\`).join('') || '<li class="h-empty">최근 7일 입찰 중인 새 공고에 아스콘 물량이 적힌 내역서가 없어요.</li>';
  $('[data-tons-source]').textContent = \`공고 내역서에 적힌 아스콘 물량 · 입찰 중인 새 공고 \${num(rows.length)}건 중 내역서에 아스콘이 있는 \${num(withTons.length)}건\`;
  phone.tons = withTons.length ? {n: Math.round(total), top: top[0][0]} : null;
  drawDueLines();
}

// ---------- The hook: where the asphalt for a work would come from ----------
// Each deadline row gets the nearest plant that is operating and has a shopping-mall price for that site's area
// (site_plant_prices: straight line from the site's district centre, since notices carry no address).
// Only prices tied to the plant for sure (checked by hand, or the only plant of that name) are shown (ui/ties.js, D-53).
const SPEC_NAME = new Map(SPECS.map(([key, name, code]) => [key, \`\${name} \${code}\`]));
const manwon = value => num(Math.round(value / 1000) / 10, 1);
const priceText = g => \`\${esc(SPEC_NAME.get(g.spec_group) || g.spec_group)} \${g.high_price > g.low_price ? \`\${manwon(g.low_price)}~\${manwon(g.high_price)}\` : manwon(g.low_price)}만 원\`;
// Straight-line km to one decimal. Plants placed only at their district centre come out at 0km from a site in the
// same district: say so instead.
const kmText = km => km < 1 ? '같은 시군구' : \`직선 \${num(km, 1)}km\`;
const DELIVERY = {공사현장하차도: '현장 하차', '납품장소 하차도': '현장 하차', 공장상차도: '공장 출고', '생산공장 상차도': '공장 출고'};
// Same basis as the price board where there is a choice: delivered to the site before ex-plant.
const SITE_DELIVERY = /현장하차|하차도/;
function surePrice(groups) {
  const sure = (Array.isArray(groups) ? groups : []).filter(g => SURE_TIES.has(g.tie) && finite(Number(g.low_price)) && g.unit === '톤')
    .map(g => ({...g, low_price: Number(g.low_price), high_price: Number(g.high_price)}))
    .sort((a, b) => Number(SITE_DELIVERY.test(b.delivery_condition || '')) - Number(SITE_DELIVERY.test(a.delivery_condition || '')));
  return sure.find(g => g.spec_group === spec) || sure.find(g => g.spec_group === '신재 WC-2') || sure[0] || null;
}
const dueNear = new Map();
// A notice that names only its province is placed at the province centre, where the "nearest" plant can be far off
// the site, so those rows show none.
function nearLine(row) {
  const near = row.sigungu ? dueNear.get(row.notice_id) : null;
  if (!near) return '';
  const price = surePrice(sureGroups(near));
  return \`<p class="h-due-near"><span><span class="h-near-label">가까운 공장</span> <b>\${esc(near.company_name)}</b> <span class="h-due-km">\${kmText(near.km)}</span></span><span class="h-near-price">\${price ? priceText(price) : '쇼핑몰 단가 없음'}</span></p>\`;
}
async function loadDueNear(ids) {
  const want = ids.filter(id => !dueNear.has(id));
  if (!want.length) return;
  for (const id of want) dueNear.set(id, null);
  let found = false;
  try {
    const quoted = list => \`in.(\${list.map(v => \`"\${String(v).replace(/"/g, '')}"\`).join(',')})\`;
    const places = await request('bid_places', {select: 'notice_id,place_key', notice_id: quoted(want), limit: 100});
    const keys = [...new Set(places.rows.map(row => row.place_key).filter(Boolean))];
    if (!keys.length) return;
    const near = await request('site_plant_prices', {select: 'place_key,plant_id,km,company_name,operating,prices,link_kind', place_key: quoted(keys), operating: 'is.true', order: 'km.asc', limit: 500});
    for (const place of places.rows) {
      const rows = near.rows.filter(row => row.place_key === place.place_key);
      const pick = rows.find(row => surePrice(sureGroups(row))) || rows[0];
      if (pick) { dueNear.set(place.notice_id, pick); found = true; }
    }
    if (found) drawBids();
  } catch (error) { console.warn('[home] 가까운 공장', error); }
}

// ---------- B: 내 위치에서 가까운 공장 ----------
// The position is used in this browser only; distances are straight lines to the plants' map points.
let plantPoints = null;
const haversine = (a, b) => { const R = 6371, rad = Math.PI / 180, dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
async function showNear(point, label) {
  const list = $('[data-near-list]'), lead = $('[data-near-lead]');
  plantPoints ||= (await request('plant_map', {select: 'plant_id,company_name,lat,lon,operating', operating: 'is.true', limit: 1000})).rows.filter(row => finite(row.lat) && finite(row.lon));
  const near = plantPoints.map(row => ({...row, km: haversine(point, [row.lat, row.lon])})).sort((a, b) => a.km - b.km).slice(0, 15);
  const ids = near.map(row => row.plant_id).join(',');
  const prices = ids ? (await request('plant_prices', {select: 'plant_id,tie,spec_group,unit,delivery_condition,low_price,high_price,lines', plant_id: \`in.(\${ids})\`, limit: 500})).rows : [];
  const withPrice = near.map(row => ({...row, price: surePrice(prices.filter(p => p.plant_id === row.plant_id))}));
  const top = [...withPrice.filter(row => row.price), ...withPrice.filter(row => !row.price)].slice(0, 3);
  lead.textContent = label;
  list.innerHTML = top.map(row => {
    const go = \`https://map.kakao.com/link/to/\${encodeURIComponent(row.company_name)},\${row.lat},\${row.lon}\`;
    return \`<li class="h-near-item"><span class="h-near-name">\${esc(row.company_name)}</span><span class="h-near-km">\${row.km < 1 ? '1km 안' : \`\${num(row.km, 1)}<small>km</small>\`}</span>
      <span class="h-near-sub">\${row.price ? \`\${priceText(row.price)} · \${esc(DELIVERY[row.price.delivery_condition] || row.price.delivery_condition)}\` : '쇼핑몰 단가 없음'}</span>
      <a class="h-near-go" href="\${esc(go)}" target="_blank" rel="noopener">길찾기<span class="h-sr"> (카카오맵 새 창)</span> →</a></li>\`;
  }).join('');
}
let nearByDevice = false;
// Before any permission prompt: the chosen region, or the region with the most open bids.
let nearDefault = '';
function drawNearDefault() {
  if (nearByDevice || !bids) return;
  const name = region && SIDO_POINT[region] ? region : [...bids.data.counts.entries()].filter(([n]) => SIDO_POINT[n]).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!name || name + region === nearDefault) return;
  nearDefault = name + region;
  showNear(SIDO_POINT[name], \`\${name} 중심에서 가까운 공장이에요\${region ? '' : ' (공고가 가장 많은 지역)'}. 단가가 있는 공장부터 보여 드려요.\`).catch(error => console.warn('[home] 가까운 공장', error));
}
function setupNear() {
  const button = $('[data-near-btn]'), note = $('[data-near-note]');
  if (!button) return;
  button.addEventListener('click', async () => {
    if (!navigator.geolocation) { note.textContent = '이 브라우저에서는 위치를 쓸 수 없어요.'; return; }
    button.setAttribute('aria-busy', 'true');
    try {
      const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {enableHighAccuracy: false, timeout: 10000, maximumAge: 600000}));
      nearByDevice = true;
      await showNear([pos.coords.latitude, pos.coords.longitude], '내 위치에서 가까운 공장이에요. 단가가 있는 공장부터 보여 드려요.');
    } catch (error) {
      note.textContent = error?.code === 1 ? '위치 권한을 허용하면 내 위치에서 가까운 공장을 찾아 드려요.' : '위치를 찾지 못했어요. 잠시 뒤 다시 눌러 주세요.';
    } finally {
      button.removeAttribute('aria-busy');
    }
  });
}

async function start() {
  setupMenu();
  setupTrendPointer();
  setupSide();
  setupDue();
  setupTicker();
  setupNear();
  screenHeight();
  addEventListener('resize', screenHeight);
  PC_MEDIA.addEventListener('change', drawBids);
  drawAds();
  $('.h-crew-ask')?.insertAdjacentHTML('afterbegin', icon('users'));
  const plants = loadPlants().catch(error => {
    console.warn('[home] plants', error);
    $('[data-plants-source]').innerHTML = \`공장 수를 불러오지 못했어요.<span class="h-attr">\${BOUNDARY_CREDIT}</span>\`;
    return [];
  });
  // The map (1.5–2.5MB of boundaries) starts only after the price board has painted, so it never competes with it.
  Promise.all([plants, priceShown]).then(([rows]) => mountHomeMap({section: $('#map'), pc: $('#co-map'), mobile: $('#mapsvg'), status: $('[data-home-map-status]'), plants: rows}));

  await Promise.allSettled([
    section('prices', livePrices, savedPrices, renderPrices, () => { fill('[data-price-value]', '–'); fill('[data-price-change]', esc(failText)); $('[data-price-status]').innerHTML = '<span>단가를 불러오지 못했어요</span>'; markPriceShown(); }),
    section('volume', liveVolume, savedVolume, renderVolume),
    section('news', liveNews, savedNews, renderNews, () => { $('[data-price-news]').innerHTML = ''; }),
    section('costs', liveCosts, savedCosts, renderCosts, () => $('[data-ticker]')?.setAttribute('hidden', '')),
    section('bids', liveBids, savedBids, renderBids, () => {
      fill('[data-today-value]', '–'); $('[data-today-meta]').textContent = failText; failList('[data-due]');
      const live = $('[data-today-live]'); live.classList.add('is-saved'); live.textContent = '불러오지 못함';
      $('[data-today]').innerHTML = '';
    }),
    section('soon', liveSoon, savedSoon, renderSoon, () => failList('[data-soon]')),
    section('crew', liveCrew, snap => snap.crew, renderCrew, () => fill('[data-crew-value]', '–')),
    section('pps', livePps, () => { throw new Error('목업: 저장 자료 없음'); }, renderPps),
    section('base', liveBase, () => { throw new Error('목업: 저장 자료 없음'); }, renderBase),
    section('results', liveResults, () => { throw new Error('목업: 저장 자료 없음'); }, renderResults),
    freshness(),
    plants,
  ]);
  if (savedSections.size) $('[data-live-status]').textContent = '일부 칸은 최신 자료를 받지 못해 저장해 둔 자료로 보여 드려요.';
}

start();
`;export{e as default};