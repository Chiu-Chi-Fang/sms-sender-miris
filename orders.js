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

  const txt = el.value?.trim();
  if (!txt) return alert('請先貼上資料喔！');

  const lines = txt.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return;

  // 允許 tab / | 分隔（Excel 複製通常是 tab）
  const splitCols = (line) => line.split(/[|\t]+/).map(s => s.trim()).filter(Boolean);

  const header = splitCols(lines[0]);

  // 判斷第一列是不是標題列
  const headerKeywords = new Set(['訂單號', '姓名', '電話', '平台', '門市', '出貨日', '取貨期限', '物流單號']);
  const isHeader = header.some(h => headerKeywords.has(h));

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
      trackingNum: map['物流單號'] ?? idx.trackingNum,
    };
  }

  const start = isHeader ? 1 : 0;
  let count = 0;

  for (let i = start; i < lines.length; i++) {
    const cols = splitCols(lines[i]);
    if (cols.length < 2) continue;

    let rawPlatform = cols[idx.platform] || '';
    let finalPlatform = rawPlatform;

    if (rawPlatform.includes('賣貨便')) finalPlatform = '7-11';
    else if (rawPlatform.includes('好賣')) finalPlatform = '全家';

    const trackingNum = (cols[idx.trackingNum] || '').trim();
    if (!trackingNum) continue; // 只匯入有物流單號的

    payOrders.push({
      no: (cols[idx.no] || '').trim(),
      name: (cols[idx.name] || '').trim(),
      phone: (cols[idx.phone] || '').trim(),
      platform: finalPlatform,
      store: (cols[idx.store] || '').trim(),
      shipDate: (cols[idx.shipDate] || '').trim(),
      deadline: (cols[idx.deadline] || '').trim(),
      trackingNum,
      pickupDate: null,
      trackingStatus: ''
    });

    count++;
  }

  if (count > 0) {
    savePayOrders();
    alert(`成功匯入 ${count} 筆資料！`);
    el.value = '';
    if (window.switchPaySubTab) window.switchPaySubTab('orders');
  } else {
    alert('沒有匯入任何資料：請確認「物流單號」欄有值，且資料是 Tab 分隔或貼上格式正確。');
  }
}

// ==========================================
// ★★★ 查詢貨況（做法1：讀 data/inbox.json）★★★
// ==========================================
async function checkAllTrackingImpl() {
  const indices = Array.from(document.querySelectorAll('.pay-chk:checked'))
    .map(c => parseInt(c.dataset.idx, 10));

  if (indices.length === 0) return alert('請先勾選要查詢的訂單');
  if (!confirm(`準備更新 ${indices.length} 筆訂單貨況...\n(系統將讀取 ./data/inbox.json)`)) return;

  indices.forEach(i => { if (payOrders[i]) payOrders[i].trackingStatus = "⏳ 查詢中..."; });
  renderPayTable();

  try {
    const inboxRes = await fetch(`./data/inbox.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!inboxRes.ok) throw new Error(`讀取 inbox.json 失敗: ${inboxRes.status}`);

    const inboxData = await inboxRes.json();
    const packageList = inboxData.data || [];

    // 建立快查表: 單號 -> { text, code, time }
packageList.forEach(item => {
  const tn = item?.package?.tracking_number;
  
  // ★★★ DEBUG：印出完整資料結構 ★★★
  if (tn && tn.includes("M58071369422")) {  // 用陳玟君那筆單號測試
    console.log("📦 完整 package 資料:", JSON.stringify(item?.package, null, 2));
    console.log("📦 latest_package_history:", item?.package?.latest_package_history);
    console.log("📦 package_history 陣列:", item?.package?.package_history);
  }

      statusMap[String(tn).trim()] = { text, code, time };
    });

    let updatedCount = 0;

    indices.forEach(idx => {
      const order = payOrders[idx];
      if (!order) return;

      const trackNo = String(order.trackingNum || "").trim();
      if (!trackNo) {
        order.trackingStatus = "查無(未填單號)";
        return;
      }

      const s = statusMap[trackNo];

      if (s) {
        let showStatus = s.text || "";

        if (!showStatus) {
          const code = String(s.code || "");
          if (code.includes("delivered") || code.includes("arrived")) showStatus = "已配達";
          else if (code.includes("transit")) showStatus = "配送中";
          else if (code.includes("pending")) showStatus = "待出貨";
          else if (code.includes("picked_up")) showStatus = "已取件";
          else if (code.includes("shipping")) showStatus = "運送中";
          else showStatus = "更新中";
        }

        order.trackingStatus = showStatus;
        updatedCount++;

        const code2 = String(s.code || "");
        if (showStatus.includes("已配達") || showStatus.includes("已取") || showStatus.includes("成功取件") || code2.includes("delivered")) {
          if (!order.pickupDate && s.time) {
            order.pickupDate = s.time;  // 已經是 "2026-01-18" 格式
          }
        }
      } else {
        order.trackingStatus = "查無(或未入庫)";
      }
    });

    savePayOrders();
    alert(`查詢完成！更新了 ${updatedCount} 筆訂單狀態。`);

  } catch (e) {
    console.error("Tracking Error:", e);

    indices.forEach(i => {
      if (payOrders[i] && payOrders[i].trackingStatus === "⏳ 查詢中...") {
        payOrders[i].trackingStatus = "❌ 讀取失敗";
      }
    });

    savePayOrders();
    alert("執行失敗：無法讀取 data/inbox.json\n\n請檢查：\n1) GitHub Actions 是否已產生 data/inbox.json\n2) GitHub Pages 是否有部署 data/inbox.json");
  }
}


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
  const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx, 10));
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
  const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx, 10));
  if (indices.length === 0) return;

  if (confirm(`刪除 ${indices.length} 筆？`)) {
    indices.sort((a, b) => b - a).forEach(i => payOrders.splice(i, 1));
    savePayOrders();
    document.getElementById('selectAllPay').checked = false;
  }
};

window.pushToSMS = function () {
  const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx, 10));
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
