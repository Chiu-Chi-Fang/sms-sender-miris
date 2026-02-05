// orders.js - 雲端同步版（已移除追蹤物流、加入快速查詢/已到店+7天）

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

console.log(`🚀 orders.js Loaded at ${new Date().toLocaleTimeString()}`);

// ★★★ Firebase 設定 ★★★
const firebaseConfig = {
  apiKey: "AIzaSyDcKclyNssDs08E0DIwfrc7lzq3QQL4QS8",
  authDomain: "sms-miris.firebaseapp.com",
  databaseURL: "https://sms-miris-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sms-miris",
  storageBucket: "sms-miris.firebasestorage.app",
  messagingSenderId: "340097404227",
  appId: "1:340097404227:web:554901219608cbed42f3f6"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const payOrdersRef = ref(db, 'pay_orders');

let payOrders = [];

// =====================================================
// 工具：日期/文字
// =====================================================
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function addDaysISO(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function mmdd(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr; // 以防格式不是 ISO
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}`;
}


function normalizeOrderNo(v) {
  // 忽略 #、空白、全形井字；統一轉小寫（保險）
  return String(v || '')
    .trim()
    .replace(/[＃#\s]/g, '')
    .toLowerCase();
}

function safeStr(v) {
  return String(v ?? '').trim();
}

// =====================================================
// Firebase 同步
// =====================================================
function savePayOrders() {
  set(payOrdersRef, payOrders).catch((err) => console.error('同步失敗', err));
}

// =====================================================
// 撥款日計算（保留你原本邏輯）
// =====================================================
function calculatePaymentDate(platform, pickupDateStr) {
  if (!pickupDateStr) return { settlement: '-', payment: '-' };
  const pickupDate = new Date(pickupDateStr);
  const dow = pickupDate.getDay();
  let settlementDate, paymentDate;

  const addDays = (d, n) => {
    const date = new Date(d);
    date.setDate(date.getDate() + n);
    return date;
  };

  const getNextWeekday = (d, t) => {
    const date = new Date(d);
    const cur = date.getDay();
    let add = t - cur;
    if (add <= 0) add += 7;
    date.setDate(date.getDate() + add);
    return date;
  };

  if (platform && (platform.includes('賣貨便') || platform.includes('7-11'))) {
    if (dow >= 1 && dow <= 3) { settlementDate = getNextWeekday(pickupDate, 4); paymentDate = addDays(settlementDate, 4); }
    else { settlementDate = getNextWeekday(pickupDate, 1); paymentDate = addDays(settlementDate, 2); }
  } else {
    if (dow >= 1 && dow <= 3) { settlementDate = getNextWeekday(pickupDate, 5); paymentDate = addDays(settlementDate, 4); }
    else { settlementDate = getNextWeekday(pickupDate, 3); paymentDate = addDays(settlementDate, 1); }
  }

  return {
    settlement: settlementDate.toISOString().split('T')[0],
    payment: paymentDate.toISOString().split('T')[0]
  };
}

// =====================================================
// ✅ 新功能：到店/重設到店（到店日 +7 = 取貨期限）
// =====================================================
function ensureOrderShape(o) {
  // 舊資料相容：補齊新欄位
  if (o && typeof o === 'object') {
    if (!('arrivedDate' in o)) o.arrivedDate = null; // 新增
    // deadline 原本可能是 null/undefined，統一成字串或 ''
    if (!('deadline' in o)) o.deadline = '';
  }
  return o;
}

function markArrivedImpl(index, dateStr) {
  const arrived = dateStr || todayISO();
  payOrders[index].arrivedDate = arrived;
  payOrders[index].deadline = addDaysISO(arrived, 7);
  savePayOrders();
}

function resetArrivedImpl(index) {
  payOrders[index].arrivedDate = null;
  payOrders[index].deadline = '';
  savePayOrders();
}

// =====================================================
// ✅ 新功能：快速查詢（訂單號/姓名）
// =====================================================
function matchQuickSearch(order) {
  const qRaw = safeStr(document.getElementById('quickSearch')?.value);
  if (!qRaw) return true;

  const q = qRaw.toLowerCase();
  const qNo = normalizeOrderNo(qRaw);

  const orderNo = normalizeOrderNo(order.no);
  const name = safeStr(order.name).toLowerCase();

  // 規則：
  // - 如果使用者輸入像訂單號（含#或純數字/字母），就用 normalize 比對訂單號包含
  // - 同時也讓姓名可包含比對
  const hitNo = qNo && orderNo.includes(qNo);
  const hitName = name.includes(q);

  return hitNo || hitName;
}

// =====================================================
// 表格渲染
// =====================================================
function renderPayTable() {
  const tbody = document.getElementById('payTableBody');
  if (!tbody) return;

  // 舊資料相容：先補欄位
  payOrders = payOrders.map(ensureOrderShape);

  tbody.innerHTML = '';

  const totalCount = payOrders.length;
  const pickedCount = payOrders.filter(o => o.pickupDate).length;
  const unpickedCount = totalCount - pickedCount;

  if (document.getElementById('cnt-all')) document.getElementById('cnt-all').innerText = `(${totalCount})`;
  if (document.getElementById('cnt-picked')) document.getElementById('cnt-picked').innerText = `(${pickedCount})`;
  if (document.getElementById('cnt-unpicked')) document.getElementById('cnt-unpicked').innerText = `(${unpickedCount})`;

  if (payOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#999; padding:20px;">☁️ 目前無訂單，請從 Excel 複製貼上</td></tr>`;
    return;
  }

  const filterEl = document.querySelector('input[name="statusFilter"]:checked');
  const filterVal = filterEl ? filterEl.value : 'all';

  payOrders.forEach((order, index) => {
    const isPicked = !!order.pickupDate;
    if (filterVal === 'picked' && !isPicked) return;
    if (filterVal === 'unpicked' && isPicked) return;

    // ✅ 快速查詢（訂單號/姓名）
    if (!matchQuickSearch(order)) return;

// ✅ 到店狀態欄（取代物流追蹤）
const arrivedVal = order.arrivedDate || todayISO();
const deadlineVal = order.deadline || addDaysISO(arrivedVal, 7);

let arriveHtml = `
  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
    <div style="position:relative; display:inline-block;">
      <div class="fake-date-btn">📅 ${mmdd(arrivedVal)}</div>

      <input
        id="arriveDate_${index}"
        type="date"
        value="${arrivedVal}"
        oninput="markArrived(${index}, this.value)"
        aria-label="到店日期"
        style="
          position:absolute; inset:0;
          width:100%; height:100%;
          opacity:0;
          cursor:pointer;
        "
      />
    </div>

    <button class="btn btn-secondary btn-sm" onclick="resetArrived(${index})">重設</button>
  </div>

  <div style="margin-top:6px; font-size:12px; color:#666;">
    取貨期限：${mmdd(deadlineVal)}
  </div>
`;

if (order.arrivedDate) {
  arriveHtml = `
    <div style="font-size:12px; font-weight:800; color:#28a745; margin-bottom:6px;">
      已到店（${mmdd(order.arrivedDate)}）
    </div>
  ` + arriveHtml;
}

    // 原本狀態/撥款日欄
    let statusHtml = '';
    if (order.pickupDate) {
      const calc = calculatePaymentDate(order.platform, order.pickupDate);
      statusHtml = `<div style="text-align:right">
        <button class="btn btn-success btn-sm" onclick="resetOrderStatus(${index})">✅ 已取 (${order.pickupDate.slice(5)})</button>
        <div style="font-size:13px; color:#d63031; font-weight:bold; margin-top:4px;">💰 撥款: ${calc.payment}</div>
      </div>`;
    } else {
      statusHtml = `<div class="action-wrapper">
        <button class="btn btn-danger btn-sm" style="pointer-events: none;">📦 未取貨</button>
        <input type="date" class="hidden-date-input" onchange="updateOrderPickup(${index}, this.value)">
      </div>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="pay-chk" data-idx="${index}"></td>
      <td>${order.no || ''}</td>
      <td>${order.name || ''}</td>
      <td>${order.phone || ''}</td>
      <td><span style="background:#eee; padding:2px 6px; border-radius:4px; font-size:12px">${order.platform || ''}</span></td>
      <td>${order.shipDate || '-'}</td>
      <td>${mmdd(order.deadline)}</td>
      <td>${arriveHtml}</td>
      <td>${statusHtml}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="deleteOrder(${index})">❌</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// =====================================================
// 匯入（貼上文字）
// =====================================================
function importFromTextImpl() {
  const el = document.getElementById('importText');
  if (!el) return;

  const txt = el.value?.trim();
  if (!txt) return alert('請先貼上資料喔！');

  const lines = txt.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return;

  const splitCols = (line) => line.split(/[|\t]+/).map(s => s.trim()).filter(Boolean);
  const header = splitCols(lines[0]);

  const headerKeywords = new Set(['訂單號', '姓名', '電話', '平台', '門市', '出貨日', '取貨期限', '物流單號']);
  const isHeader = header.some(h => headerKeywords.has(h));

  // 預設欄位順序（你可依實際 Excel 內容調）
  let idx = { no: 0, name: 1, phone: 2, platform: 3, store: 4, shipDate: 5, deadline: 6, trackingNum: 7 };

  if (isHeader) {
    const map = {};
    header.forEach((h, i) => { map[h] = i; });
    idx = {
      no: map['訂單號'] ?? idx.no,
      name: map['姓名'] ?? idx.name,
      phone: map['電話'] ?? idx.phone,
      platform: map['平台'] ?? idx.platform,
      store: map['門市'] ?? idx.store,
      shipDate: map['出貨日'] ?? idx.shipDate,
      deadline: map['取貨期限'] ?? idx.deadline,
      trackingNum: map['物流單號'] ?? idx.trackingNum
    };
  }

  const start = isHeader ? 1 : 0;
  const newOrders = [];

  for (let i = start; i < lines.length; i++) {
    const cols = splitCols(lines[i]);
    if (cols.length < 2) continue;

    const order = {
      no: cols[idx.no] || '',
      name: cols[idx.name] || '',
      phone: cols[idx.phone] || '',
      platform: cols[idx.platform] || '',
      store: cols[idx.store] || '',
      shipDate: cols[idx.shipDate] || '',
      // ✅ deadline 允許空白（你要的：到店後再自動算）
      deadline: cols[idx.deadline] || '',
      trackingNum: cols[idx.trackingNum] || '',
      pickupDate: null,

      // ✅ 新欄位：到店日
      arrivedDate: null
    };

    newOrders.push(order);
  }

  if (newOrders.length === 0) return alert('沒有解析到任何資料，請確認貼上的格式。');

  // 直接合併（或你要去重可再加規則）
  payOrders = payOrders.concat(newOrders).map(ensureOrderShape);
  savePayOrders();

  // 清空輸入
  el.value = '';
}

// =====================================================
// 新增單筆
// =====================================================
function addNewOrderImpl() {
  const no = safeStr(document.getElementById('addOrderNo')?.value);
  const name = safeStr(document.getElementById('addName')?.value);
  const phone = safeStr(document.getElementById('addPhone')?.value);
  const platform = safeStr(document.getElementById('addPlatform')?.value);
  const shipDate = safeStr(document.getElementById('addShipDate')?.value);
  const deadline = safeStr(document.getElementById('addDeadline')?.value);

  if (!no || !name) return alert('訂單號與姓名必填');

  payOrders.push(ensureOrderShape({
    no,
    name,
    phone,
    platform,
    shipDate,
    // ✅ deadline 可留空（到店再算）
    deadline: deadline || '',
    pickupDate: null,

    // ✅ 新欄位
    arrivedDate: null
  }));

  savePayOrders();

  // 清空表單
  if (document.getElementById('addOrderNo')) document.getElementById('addOrderNo').value = '';
  if (document.getElementById('addName')) document.getElementById('addName').value = '';
  if (document.getElementById('addPhone')) document.getElementById('addPhone').value = '';
  if (document.getElementById('addShipDate')) document.getElementById('addShipDate').value = '';
  if (document.getElementById('addDeadline')) document.getElementById('addDeadline').value = '';
}

// =====================================================
// 訂單狀態：更新取貨日 / 重設
// =====================================================
function updateOrderPickupImpl(index, val) {
  payOrders[index].pickupDate = val || null;
  savePayOrders();
}

function resetOrderStatusImpl(index) {
  payOrders[index].pickupDate = null;
  savePayOrders();
}

// =====================================================
// 刪除 / 批量刪除 / 全選
// =====================================================
function deleteOrderImpl(index) {
  if (!confirm('確定刪除這筆訂單？')) return;
  payOrders.splice(index, 1);
  savePayOrders();
}

function toggleSelectAllPayImpl() {
  const master = document.getElementById('selectAllPay');
  const checks = document.querySelectorAll('.pay-chk');
  checks.forEach(chk => { chk.checked = master.checked; });
}

function batchDeleteOrdersImpl() {
  const checks = Array.from(document.querySelectorAll('.pay-chk')).filter(chk => chk.checked);
  if (checks.length === 0) return alert('請先勾選要刪除的訂單');

  if (!confirm(`確定刪除 ${checks.length} 筆？`)) return;

  const idxs = checks.map(chk => Number(chk.dataset.idx)).sort((a, b) => b - a);
  idxs.forEach(i => payOrders.splice(i, 1));
  savePayOrders();
}

// =====================================================
// 批量指定日期（保留：你原本用來指定 deadline 或 shipDate）
// 你沒說要改這個，我先保持：批量指定「取貨期限」
// =====================================================
function batchSetDateImpl() {
  const date = document.getElementById('batchDateInput')?.value;
  if (!date) return alert('請先選日期');

  const checks = Array.from(document.querySelectorAll('.pay-chk')).filter(chk => chk.checked);
  if (checks.length === 0) return alert('請先勾選要套用的訂單');

  checks.forEach(chk => {
    const idx = Number(chk.dataset.idx);
    payOrders[idx].deadline = date;
  });

  savePayOrders();
}

// =====================================================
// 匯出 Excel（若你原本有更完整版本，可覆蓋這段）
// =====================================================
function exportOrdersExcelImpl() {
  // 簡易 CSV 匯出（避免外部 library）
  const header = ['訂單號', '姓名', '電話', '平台', '出貨日', '到店日', '取貨期限', '取貨日'];
  const rows = payOrders.map(o => [
    o.no || '',
    o.name || '',
    o.phone || '',
    o.platform || '',
    o.shipDate || '',
    o.arrivedDate || '',
    o.deadline || '',
    o.pickupDate || ''
  ]);

  const csv = [header, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders_${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// =====================================================
// SMS 帶入（保留入口；你原本若有完整 SMS 邏輯請自行保留/貼回）
// =====================================================
function pushToSMSImpl() {
  const checks = Array.from(document.querySelectorAll('.pay-chk')).filter(chk => chk.checked);
  if (checks.length === 0) return alert('請先勾選要帶入 SMS 的訂單');

  const list = checks.map(chk => {
    const idx = Number(chk.dataset.idx);
    const o = payOrders[idx] || {};
    return {
      no: o.no || '',
      name: o.name || '',
      phone: o.phone || '',
      deadline: o.deadline || '',
      store: o.store || '',
      platform: o.platform || ''
    };
  });

  if (typeof window.receiveOrdersFromPay !== 'function') {
    alert('SMS 模組尚未載入：請確認 index.html 已加入 <script type="module" src="sms.js"></script>');
    return;
  }

  window.receiveOrdersFromPay(list);
  alert(`已帶入 SMS：${list.length} 筆`);
}


// =====================================================
// 撥款日試算（pay-sub-calc）
// =====================================================
function doCalcImpl() {
  const platform = document.getElementById('calcPlatform')?.value || '';
  const date = document.getElementById('calcDate')?.value || '';
  const r = calculatePaymentDate(platform, date);
  const box = document.getElementById('calcResult');
  if (!box) return;
  box.style.display = 'block';
  box.innerHTML = `結算日：${r.settlement}<br>撥款日：${r.payment}`;
}

// =====================================================
// Tab 切換（如果你原本在別的檔案，這段可刪；這裡先提供基本版避免報錯）
// =====================================================
function switchTabImpl(id, btn) {
  document.querySelectorAll('.shell-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');

  document.querySelectorAll('.shell-tab').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
}

function switchSmsSubTabImpl(which) {
  document.querySelectorAll('.pay-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.pay-tab').forEach(t => t.classList.remove('active'));

  if (which === 'list') {
    document.getElementById('sms-sub-list')?.classList.add('active');
    document.querySelectorAll('.pay-tab')[0]?.classList.add('active');
  } else {
    document.getElementById('sms-sub-tpl')?.classList.add('active');
    document.querySelectorAll('.pay-tab')[1]?.classList.add('active');
  }
}

// =====================================================
// 安全重繪（給搜尋/篩選用）
// =====================================================
function safeRenderImpl() {
  try { renderPayTable(); } catch (e) { console.error(e); }
}

// =====================================================
// 綁定 window（HTML onclick 會用到）
// =====================================================
window.importFromText = importFromTextImpl;
window.addNewOrder = addNewOrderImpl;

window.updateOrderPickup = updateOrderPickupImpl;
window.resetOrderStatus = resetOrderStatusImpl;

window.deleteOrder = deleteOrderImpl;
window.toggleSelectAllPay = toggleSelectAllPayImpl;
window.batchDeleteOrders = batchDeleteOrdersImpl;

window.batchSetDate = batchSetDateImpl;
window.exportOrdersExcel = exportOrdersExcelImpl;
window.pushToSMS = pushToSMSImpl;

window.doCalc = doCalcImpl;

window.switchTab = switchTabImpl;
window.switchSmsSubTab = switchSmsSubTabImpl;

window.safeRender = safeRenderImpl;

// ✅ 新功能（到店）
window.markArrived = markArrivedImpl;
window.resetArrived = resetArrivedImpl;

// =====================================================
// 啟動：監聽 Firebase
// =====================================================
onValue(payOrdersRef, (snap) => {
  const val = snap.val();
  payOrders = Array.isArray(val) ? val : (val ? Object.values(val) : []);
  payOrders = payOrders.map(ensureOrderShape);
  renderPayTable();
});
