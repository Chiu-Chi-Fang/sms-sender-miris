// orders.js - 雲端同步版（做法1：前端不直連 Track，只讀 data/inbox.json 更新狀態）

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

console.log(`🚀 orders.js Loaded at ${new Date().toLocaleTimeString()}`);

// ★★★ 請填入您的 Firebase 設定 (sms-miris) ★★★
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

const carrierMap = {
  '7-11': '9a980809-8865-4741-9f0a-3daaaa7d9e19',
  '賣貨便': '9a980809-8865-4741-9f0a-3daaaa7d9e19',
  '全家': '9a980968-0ecf-4ee5-8765-fbeaed8a524e',
  '好賣+': '9a980968-0ecf-4ee5-8765-fbeaed8a524e',
  '萊爾富': '9a980b3f-450f-4564-b73e-2ebd867666b0',
  'OK': '9a980d97-1101-4adb-87eb-78266878b384',
  '蝦皮': '9a98100c-c984-463d-82a6-ae86ec4e0b8a',
  '宅配通': '9a984351-dc4f-405b-971c-671220c75f21',
  '新竹物流': '9a9840bc-a5d9-4c4a-8cd2-a79031b4ad53',
  '嘉里大榮': '9a98424a-935f-4b23-9a94-a08e1db52944',
  '黑貓': '9a98160d-27e3-40ab-9357-9d81466614e0',
  '郵局': '9a9812d2-c275-4726-9bdc-2ae5b4c42c73'
};

onValue(payOrdersRef, (snapshot) => {
  const data = snapshot.val();
  payOrders = data || [];
  renderPayTable();
});

function savePayOrders() {
  set(payOrdersRef, payOrders).catch((err) => console.error('同步失敗', err));
}

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

function importFromTextImpl() {
  const el = document.getElementById('importText');
  if (!el) return;

  const txt = el.value;
  if (!txt) return alert('請先貼上資料喔！');

  const lines = txt.split('\n');
  let count = 0;

  lines.forEach(line => {
    if (!line.trim()) return;

    const cols = line.trim().split(/[|\t,\s]+/).filter(Boolean);

    if (cols.length >= 3) {
      let rawPlatform = cols[3] || '';
      let finalPlatform = rawPlatform;

      if (rawPlatform.includes('賣貨便')) finalPlatform = '7-11';
      else if (rawPlatform.includes('好賣')) finalPlatform = '全家';

      let trackNo = cols[7] || '';

      payOrders.push({
        no: cols[0],
        name: cols[1],
        phone: cols[2],
        platform: finalPlatform,
        store: cols[4] || '',
        shipDate: cols[5] || '',
        deadline: cols[6] || '',
        trackingNum: trackNo,
        pickupDate: null,
        trackingStatus: ''
      });

      count++;
    }
  });

  if (count > 0) {
    savePayOrders();
    alert(`成功匯入 ${count} 筆資料！`);
    el.value = '';
    if (window.switchPaySubTab) window.switchPaySubTab('orders');
  }
}

// ==========================================
// ★★★ 查詢貨況（做法1：讀 data/inbox.json）★★★
// ==========================================
async function checkAllTrackingImpl() {
  const indices = Array.from(document.querySelectorAll('.pay-chk:checked'))
    .map(c => parseInt(c.dataset.idx));

  if (indices.length === 0) return alert('請先勾選要查詢的訂單');

  // 做法1：不需要 proxy 開通提示了
  if (!confirm(`準備更新 ${indices.length} 筆訂單貨況...\n(系統將讀取 ./data/inbox.json)`)) return;

  // 標記為查詢中
  indices.forEach(i => { payOrders[i].trackingStatus = "⏳ 查詢中..."; });
  renderPayTable();

  try {
    // ✅ 讀同源靜態檔，避免快取加 ts
    const inboxRes = await fetch(`./data/inbox.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!inboxRes.ok) throw new Error(`讀取 inbox.json 失敗: ${inboxRes.status}`);

    const inboxData = await inboxRes.json();
    const packageList = inboxData.data || [];

    // 建立快查表: 單號 -> 狀態
    const statusMap = {};
    packageList.forEach(item => {
      const tn = item?.package?.tracking_number;
      if (!tn) return;

      // 優先使用 latest_package_history
      let status = item?.package?.latest_package_history;

      // 兼容：若沒有 latest_package_history，就試著從 package_history 拿
      const ph = item?.package?.package_history;
      if (!status && Array.isArray(ph) && ph.length > 0) {
        status = ph[0]?.status || ph[0]?.checkpoint_status;
      }

      if (status) statusMap[tn] = status;
    });

    // 更新本地訂單
    let updatedCount = 0;

    indices.forEach(idx => {
      const order = payOrders[idx];
      const trackNo = order.trackingNum || order.no;
      const status = statusMap[trackNo];

      if (status) {
        let showStatus = String(status);

        // 翻譯（沿用你原本規則）
        if (showStatus.includes("delivered") || showStatus.includes("arrived")) showStatus = "已配達";
        if (showStatus.includes("transit")) showStatus = "配送中";
        if (showStatus.includes("pending")) showStatus = "待出貨";
        if (showStatus.includes("picked_up")) showStatus = "已取件";
        if (showStatus.includes("shipping")) showStatus = "運送中";

        order.trackingStatus = showStatus;
        updatedCount++;

        // 自動填入日期（維持你原本邏輯）
        if (showStatus.includes("已配達") || showStatus.includes("已取")) {
          if (!order.pickupDate) order.pickupDate = new Date().toISOString().split('T')[0];
        }
      } else {
        order.trackingStatus = "查無(或未入庫)";
      }
    });

    savePayOrders();
    alert(`查詢完成！更新了 ${updatedCount} 筆訂單狀態。\n（提醒：Track 那邊沒匯入單號就會顯示查無）`);

  } catch (e) {
    console.error("Tracking Error:", e);

    indices.forEach(i => {
      if (payOrders[i].trackingStatus === "⏳ 查詢中...") {
        payOrders[i].trackingStatus = "❌ 讀取失敗";
      }
    });

    savePayOrders();

    alert(
      "執行失敗：無法讀取 data/inbox.json\n\n" +
      "請檢查：\n" +
      "1) GitHub Actions 是否已產生 data/inbox.json\n" +
      "2) GitHub Pages 是否有部署 data/inbox.json（網址能直接打開）"
    );
  }
}

function renderPayTable() {
  const tbody = document.getElementById('payTableBody');
  if (!tbody) return;

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

    const queryNo = order.trackingNum || order.no;
    let trackHtml = '<span style="color:#ccc;">-</span>';

    if (order.trackingStatus && order.trackingStatus.includes('❌')) {
      let linkUrl = "#";
      if (order.platform && order.platform.includes("7-11")) linkUrl = `https://eservice.7-11.com.tw/E-Tracking/search.aspx?shipNum=${queryNo}`;
      else if (order.platform && order.platform.includes("全家")) linkUrl = `https://www.famiport.com.tw/Web_Famiport/page/process.aspx`;

      trackHtml = `<a href="${linkUrl}" target="_blank" class="btn btn-sm" style="background:#dc3545; color:white; font-size:12px; padding:2px 8px; text-decoration:none;">${order.trackingStatus}</a>`;
    }
    else if (order.trackingStatus) {
      let trackColor = '#007bff';
      if (order.trackingStatus.includes('已配達') || order.trackingStatus.includes('已取')) trackColor = '#28a745';
      trackHtml = `<span style="font-size:12px; color:${trackColor}; font-weight:bold;">${order.trackingStatus}</span>`;
    }

    const subNoHtml = order.trackingNum ? `<br><span style="font-size:10px; color:#999;">🚚 ${order.trackingNum}</span>` : '';
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
    tr.innerHTML = `<td><input type="checkbox" class="pay-chk" data-idx="${index}"></td>
      <td>${order.no}</td>
      <td>${order.name}</td>
      <td>${order.phone}</td>
      <td><span style="background:#eee; padding:2px 6px; border-radius:4px; font-size:12px">${order.platform}</span></td>
      <td>${order.shipDate || '-'}</td>
      <td>${order.deadline || '-'}</td>
      <td>${trackHtml} ${subNoHtml}</td>
      <td>${statusHtml}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="deleteOrder(${index})">❌</button></td>`;
    tbody.appendChild(tr);
  });
}

// 綁定 Window
window.importFromText = importFromTextImpl;
window.renderPayTable = renderPayTable;
window.checkAllTracking = checkAllTrackingImpl;

window.addNewOrder = function () {
  const no = document.getElementById('addOrderNo').value;
  const name = document.getElementById('addName').value;
  if (!no || !name) return alert('請填寫完整資訊');

  let p = document.getElementById('addPlatform').value;
  if (p.includes('賣貨便')) p = '7-11';
  if (p.includes('好賣')) p = '全家';

  payOrders.push({
    no: no.startsWith('#') ? no : '#' + no,
    name: name,
    phone: document.getElementById('addPhone').value,
    platform: p,
    store: '',
    shipDate: document.getElementById('addShipDate').value,
    deadline: document.getElementById('addDeadline').value,
    pickupDate: null,
    trackingStatus: '',
    trackingNum: ''
  });

  savePayOrders();
  alert('新增成功！');
};

window.updateOrderPickup = function (index, dateStr) {
  if (dateStr) {
    payOrders[index].pickupDate = dateStr;
    savePayOrders();
    if (window.removeSMSOrder) window.removeSMSOrder(payOrders[index].no);
  }
};

window.resetOrderStatus = function (index) {
  if (confirm('重設為未取貨？')) {
    payOrders[index].pickupDate = null;
    savePayOrders();
  }
};

window.deleteOrder = function (index) {
  if (confirm('確定刪除？')) {
    payOrders.splice(index, 1);
    savePayOrders();
  }
};

window.toggleSelectAllPay = function () {
  const checked = document.getElementById('selectAllPay').checked;
  document.querySelectorAll('.pay-chk').forEach(c => c.checked = checked);
};

window.batchSetDate = function () {
  const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx));
  if (indices.length === 0) return alert('請先勾選訂單');

  const dateVal = document.getElementById('batchDateInput').value;
  if (!dateVal) return alert('請先選擇日期');

  if (confirm(`將選取的 ${indices.length} 筆訂單設為 ${dateVal} 取貨？`)) {
    indices.forEach(i => {
      payOrders[i].pickupDate = dateVal;
      if (window.removeSMSOrder) window.removeSMSOrder(payOrders[i].no);
    });
    savePayOrders();
  }
};

window.batchDeleteOrders = function () {
  const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx));
  if (indices.length === 0) return;

  if (confirm(`刪除 ${indices.length} 筆？`)) {
    indices.sort((a, b) => b - a).forEach(i => payOrders.splice(i, 1));
    savePayOrders();
    document.getElementById('selectAllPay').checked = false;
  }
};

window.pushToSMS = function () {
  const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx));
  if (indices.length === 0) return alert('請先勾選訂單');

  const dataToSync = indices.map(i => payOrders[i]);
  if (window.receiveOrdersFromPay) {
    window.receiveOrdersFromPay(dataToSync);
    alert(`已同步 ${indices.length} 筆訂單到 SMS 系統！`);
    switchMainTab('sms');
  } else {
    alert('SMS 模組尚未載入，請稍候');
  }
};

window.doCalc = function () {
  const p = document.getElementById('calcPlatform').value;
  const d = document.getElementById('calcDate').value;
  if (!d) return;

  const res = calculatePaymentDate(p, d);
  document.getElementById('calcResult').innerText = `💰 預計撥款日：${res.payment}`;
};

window.exportOrdersExcel = function () {
  if (!payOrders || payOrders.length === 0) return alert('目前沒有訂單可以匯出');

  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.json_to_sheet(payOrders);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, "orders_backup.xlsx");
  } else {
    alert('匯出元件未載入');
  }
};

console.log("✅ orders.js 載入成功！");
