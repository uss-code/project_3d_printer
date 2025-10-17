 /* ===== กำหนดรายการเครื่อง (แก้ให้ตรงระบบจริงของคุณ) ===== */
    const DEVICES = [
      { number: "01", url: "http://192.168.0.101/status" },
      { number: "02", url: "http://192.168.0.102/status" },
      { number: "03", url: "http://192.168.0.103/status" },
      { number: "04", url: "http://192.168.0.104/status" },
      { number: "05", url: "http://192.168.0.105/status" },
      { number: "06", url: "http://192.168.0.106/status" },
      { number: "07", url: "http://192.168.0.107/status" },
      { number: "08", url: "http://192.168.0.108/status" },
      { number: "09", url: "http://192.168.0.109/status" },
      { number: "10", url: "http://192.168.0.110/status" },
      { number: "11", url: "http://192.168.0.111/status" },
      { number: "12", url: "http://192.168.0.112/status" }
    ];

    /* ====== ตัวช่วย UI ====== */
    const grid = document.getElementById('grid');

    function cardTemplate(d) {
      return `
    <div class="card idle" id="dev-${d.number}">
      <div class="head">
        <div>
          <div class="subtitle">เครื่องที่: ${d.number}</div>
        </div>
        <div class="status-chip idle" data-chip>🔴 ว่าง/ไม่ใช้งาน</div>
      </div>
      <div class="subtitle" data-msg>รอสถานะ...</div>
    </div>
  `;
    }

    /* วาดการ์ดเริ่มต้น */
    grid.innerHTML = DEVICES.map(cardTemplate).join('');

    /* ====== ฟังก์ชันเรียก API สถานะ ======
       คาดหวัง payload ตัวอย่าง:
       { "status": "in-use" | "idle", "progress": 0..100 }
    */
    async function fetchStatus(device) {
      const res = await fetch(device.url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }

    /* ====== ฟังก์ชันส่งคำสั่งเปลี่ยนสถานะ (ถ้าระบบคุณรองรับ) ======
       POST ไปยัง /status ด้วย body: {status: 'in-use'|'idle'}
       ปรับ endpoint/วิธีตามระบบจริงได้เลย
    */
    async function sendStatus(device, next) {
      const res = await fetch(device.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json().catch(() => ({})); // เผื่อ API ไม่คืนค่า
    }

    /* ====== อัปเดตการ์ดเดี่ยว ====== */
    function renderCard(device, payload) {
      const card = document.getElementById(`dev-${device.number}`);
      const chip = card.querySelector('[data-chip]');
      const fill = card.querySelector('[data-fill]');
      const msg = card.querySelector('[data-msg]');

      let status = 'idle';
      if (payload && payload.status === 'in-use') status = 'in-use';
      if (payload && payload.status === 'idle') status = 'idle';

      const pct = Math.max(0, Math.min(100, Number(payload?.progress ?? (status === 'in-use' ? 50 : 0))));

      card.classList.remove('in-use', 'idle', 'offline');
      chip.classList.remove('in-use', 'idle', 'offline');

      card.classList.add(status ? status : 'offline');
      chip.classList.add(status ? status : 'offline');

      if (status === 'in-use') {
        chip.textContent = '🟢 กำลังใช้งาน';
      } else if (status === 'idle') {
        chip.textContent = '🔴 ว่าง/ไม่ใช้งาน';
      } else {
        chip.textContent = '⚠️ ไม่เชื่อมต่อ';
      }

      fill.style.width = pct + '%';
      msg.textContent = (status === 'in-use')
        ? `สถานะ: กำลังพิมพ์ `
        : (status === 'idle')
          ? `สถานะ: ว่าง · พร้อมเริ่มงาน`
          : `สถานะ: ไม่เชื่อมต่อ`;
    }

    /* ====== วนดึงสถานะทุก 5 วิ ====== */
    async function refreshAll() {
      for (const d of DEVICES) {
        try {
          const data = await fetchStatus(d);
          renderCard(d, data);
        } catch (e) {
          renderCard(d, { status: 'offline', progress: 0 });
        }
      }
    }
    refreshAll();
    const timer = setInterval(refreshAll, 5000);

    /* ====== จัดการคลิกปุ่มบนการ์ด (event delegation) ====== */
    grid.addEventListener('click', async (ev) => {
      const card = ev.target.closest('.card');
      if (!card) return;
      const id = card.id.replace('dev-', '');
      const device = DEVICES.find(x => x.number === id);
      if (!device) return;

      const isToggle = ev.target.matches('[data-toggle]');
      const isSetInUse = ev.target.matches('[data-set-inuse]');
      const isSetIdle = ev.target.matches('[data-set-idle]');

      if (!(isToggle || isSetInUse || isSetIdle)) return;

      const chip = card.querySelector('[data-chip]');
      const current = chip.classList.contains('in-use') ? 'in-use'
        : chip.classList.contains('idle') ? 'idle' : 'offline';
      const next = isToggle ? (current === 'in-use' ? 'idle' : 'in-use')
        : isSetInUse ? 'in-use'
          : 'idle';

      // แสดง Optimistic UI
      renderCard(device, { status: next, progress: next === 'in-use' ? 1 : 0 });

      try {
        await sendStatus(device, next);
        // ดึงจริงอีกครั้งเพื่อความชัวร์
        const real = await fetchStatus(device);
        renderCard(device, real);
      } catch (e) {
        // ย้อนกลับด้วยการรีเฟรชสถานะจริง
        try {
          const real = await fetchStatus(device);
          renderCard(device, real);
          alert(`ไม่สำเร็จ: ${e.message}`);
        } catch {
          renderCard(device, { status: 'offline', progress: 0 });
          alert('ไม่สามารถเชื่อมต่ออุปกรณ์ได้');
        }
      }
    });

    /* ====== สลับ Dark Mode ====== */
    document.getElementById('darkBtn').addEventListener('click', () => {
      document.body.classList.toggle('dark');
      localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    });
    (function () {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark') document.body.classList.add('dark');
    })();

function init() {
    /* วาดการ์ดเริ่มต้น */
    grid.innerHTML = DEVICES.map(cardTemplate).join('');
}


function switch_mode() {
    if (document.getElementById("testBtn").style.backgroundColor == "blue") {
        document.getElementById("testBtn").style.backgroundColor = "gray"
    } else {
        document.getElementById("testBtn").style.backgroundColor = "blue";
    }    
}




