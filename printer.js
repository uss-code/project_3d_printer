// ======= ตั้งค่า =======
// วาง URL จาก Google Apps Script Web App ที่นี่ หรือวางในช่องท้ายหน้าเว็บแล้วกด "บันทึก"
const DEFAULT_API_URL = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE'; // เช่น https://script.google.com/macros/s/xxxx/exec
const AUTO_REFRESH_MS = 30_000; // รีเฟรชอัตโนมัติทุก 30 วิ (ปรับได้)

// ======= Util เก็บ/อ่านค่า URL ใน localStorage =======
const storageKey = 'printer_api_url';
function getApiUrl() {
  return localStorage.getItem(storageKey) || DEFAULT_API_URL || '';
}
function setApiUrl(url) {
  localStorage.setItem(storageKey, url);
}

// ======= DOM =======
const gridEl = document.getElementById('grid');
const updatedEl = document.getElementById('updatedAt');
const sheetNameEl = document.getElementById('sheetName');
const apiUrlInput = document.getElementById('apiUrl');
const saveApiBtn = document.getElementById('saveApi');
const refreshBtn = document.getElementById('refreshBtn');

// ======= การแมปสถานะเป็น UI =======
function renderBadge(isActive, raw) {
  const cls = isActive ? 'ok' : 'idle';
  const label = isActive ? 'ใช้งาน' : (raw?.trim() || 'ไม่ได้ใช้');
  return `<span class="badge ${cls}">
            <span class="dot">●</span>${escapeHtml(label)}
          </span>`;
}

function card(printer) {
  return `<article class="card">
    <h3>เครื่อง ${escapeHtml(printer.id)}</h3>
    ${renderBadge(printer.isActive, printer.status)}
    <div class="meta">คอลัมน์: ${printer.col}</div>
  </article>`;
}

// ======= Fetch + Render =======
async function loadAndRender() {
  const api = getApiUrl();
  if (!api) {
    gridEl.innerHTML = `<p class="meta">ยังไม่ได้ตั้งค่า API URL</p>`;
    return;
  }

  try {
    const res = await fetch(api, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    sheetNameEl.textContent = json.sheet || '—';
    updatedEl.textContent = json.updatedAt ? new Date(json.updatedAt).toLocaleString() : '—';

    if (!json.ok || !Array.isArray(json.data)) {
      gridEl.innerHTML = `<p class="meta">รูปแบบข้อมูลไม่ถูกต้อง</p>`;
      return;
    }

    // เรียงตาม id ที่เป็นตัวเลข ถ้าไม่ใช่ ปล่อยตามลำดับคอลัมน์
    const data = json.data.slice();
    const numericAll = data.every(d => /^\d+$/.test(String(d.id).trim()));
    if (numericAll) {
      data.sort((a, b) => Number(a.id) - Number(b.id));
    }

    gridEl.innerHTML = data.map(card).join('');

  } catch (err) {
    console.error(err);
    gridEl.innerHTML = `<p class="meta">โหลดข้อมูลไม่ได้: ${escapeHtml(err.message)} <br/>ตรวจสอบว่าได้ Deploy Apps Script เป็น Web App และตั้งค่า "Anyone" แล้ว</p>`;
  }
}

// ======= Helpers =======
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

// ======= Events/Init =======
apiUrlInput.value = getApiUrl();
saveApiBtn.addEventListener('click', () => {
  const val = apiUrlInput.value.trim();
  if (!val) return;
  setApiUrl(val);
  loadAndRender();
});

refreshBtn.addEventListener('click', loadAndRender);
loadAndRender();
setInterval(loadAndRender, AUTO_REFRESH_MS);
