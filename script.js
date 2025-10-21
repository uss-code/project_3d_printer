// ======= ตั้งค่า =======
const API_URL = 'https://script.google.com/macros/s/AKfycbz3V2Z4efFgtKwezMdE47XgjOPfxYiE9DDXnbFqMZq0yczOCDqNWvCnsh_8PjspY8kf/exec';
const AUTO_REFRESH_MS = 30_000;

// ======= DOM =======
const gridEl = document.getElementById('grid');
const updatedEl = document.getElementById('updatedAt');
const sheetNameEl = document.getElementById('sheetName');
const refreshBtn = document.getElementById('refreshBtn');
const modeBtns = document.querySelectorAll('.mode-btn');
const themeToggle = document.getElementById('themeToggle');

// ======= Theme (Dark/Light) =======
const THEME_KEY = 'unified_theme';
function applyTheme(theme){
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark', isDark);
  themeToggle.textContent = isDark ? '☀️' : '🌙';
}
function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark'){
    applyTheme(saved);
    return;
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
}
themeToggle.addEventListener('click', ()=>{
  const next = document.body.classList.contains('dark') ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// ======= โหมดแสดงผล (ไทย/Eng) =======
function getDisplayMode() {
  return localStorage.getItem('displayMode') || 'thai';
}
function setDisplayMode(mode) {
  localStorage.setItem('displayMode', mode === 'sheet' ? 'sheet' : 'thai');
  updateModeButtons();
  loadAndRender();
}
function updateModeButtons() {
  const mode = getDisplayMode();
  modeBtns.forEach(btn => btn.classList.toggle('is-active', btn.dataset.mode === mode));
}
modeBtns.forEach(btn => btn?.addEventListener('click', () => setDisplayMode(btn.dataset.mode)));

// ======= Helpers =======
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ======= แปลสถานะ =======
function normalizeStatus(raw) {
  if (!raw) return 'inactive';
  const s = String(raw).trim().toLowerCase();
  const activeWords = ['active','running','on','printing','busy','ใช้งาน','กำลังพิมพ์','ทำงาน','เปิด'];
  const inactiveWords = ['inactive','idle','off','available','free','ไม่ได้ใช้','ว่าง','หยุด','ปิด'];
  if (activeWords.includes(s)) return 'active';
  if (inactiveWords.includes(s)) return 'inactive';
  if (s.includes('active') || s.includes('ใช้งาน') || s.includes('กำลัง') || s.includes('print')) return 'active';
  return 'inactive';
}
function detectLang(raw) {
  const s = String(raw ?? '');
  return /[ก-๙]/.test(s) ? 'th' : 'en';
}
function getDisplayLabel(raw) {
  const n = normalizeStatus(raw);
  const mode = getDisplayMode();
  if (mode === 'thai') return n === 'active' ? 'ใช้งาน' : 'ไม่ได้ใช้';
  const lang = detectLang(raw);
  return lang === 'th' ? String(raw || '') : (n === 'active' ? 'Active' : 'Inactive');
}

// ======= id → เลข และฉลาก =======
function extractNumericId(raw) {
  const m = String(raw ?? '').match(/\d+/);
  return m ? Number(m[0]) : NaN;
}
function prettyPrinterLabel(rawId) {
  const n = extractNumericId(rawId);
  if (!Number.isNaN(n)) return `Printer ${n}`;
  const cleaned = String(rawId ?? '').replace(/machine/ig,'').trim();
  return `Printer ${cleaned || '-'}`;
}

// ======= UI =======
function renderBadge(raw) {
  const isActive = normalizeStatus(raw) === 'active';
  const cls = isActive ? 'ok' : 'idle';
  const label = getDisplayLabel(raw);
  return `<span class="badge ${cls}">
            <span class="dot"></span>${escapeHtml(label)}
          </span>`;
}
function card(printer) {
  return `<article class="card">
    <h3>${escapeHtml(prettyPrinterLabel(printer.id))}</h3>
    ${renderBadge(printer.status)}
  </article>`;
}

// ======= Fetch + Render =======
async function loadAndRender() {
  try {
    const res = await fetch(API_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // ไม่แสดงชื่อชีต
    sheetNameEl.textContent = '';

    updatedEl.textContent = json.updatedAt
      ? new Date(json.updatedAt).toLocaleString()
      : '—';

    if (!json.ok || !Array.isArray(json.data)) {
      gridEl.innerHTML = `<p class="meta">รูปแบบข้อมูลไม่ถูกต้อง</p>`;
      return;
    }

    // เรียงตามหมายเลขจาก id
    const data = json.data.slice();
    data.sort((a, b) => {
      const na = extractNumericId(a.id);
      const nb = extractNumericId(b.id);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(a.id ?? '').localeCompare(String(b.id ?? ''));
    });

    gridEl.innerHTML = data.map(card).join('');
  } catch (err) {
    console.error(err);
    gridEl.innerHTML = `<p class="meta">
      โหลดข้อมูลไม่ได้: ${escapeHtml(err.message)}<br/>
      ตรวจสอบการ Deploy Apps Script และสิทธิ์ “Anyone”
    </p>`;
  }
}

// ======= Init =======
initTheme();
updateModeButtons();
refreshBtn.addEventListener('click', loadAndRender);
loadAndRender();
setInterval(loadAndRender, AUTO_REFRESH_MS);
