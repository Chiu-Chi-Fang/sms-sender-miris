// orders.js - 雲端同步版 (無 API 追蹤)

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

// ★★★ 移除了 carrierMap (不再需要) ★★★

// ============================================
// ★★★ 核心函數 ★★★
// ============================================

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
    if (dow >= 1 && dow <= 3) { 
      settlementDate = getNextWeekday(pickupDate, 4); 
      paymentDate = addDays(settlementDate, 4); 
    } else { 
      settlementDate = getNextWeekday(pickupDate, 1); 
      paymentDate = addDays(settlementDate, 2); 
    }
  } else {
    if (dow >= 1 && dow <= 3) { 
      settlementDate = getNextWeekday(pickupDate, 5); 
      paymentDate = addDays(settlementDate, 4); 
    } else { 
      settlementDate = getNextWeekday(pickupDate, 3); 
      paymentDate = addDays(settlementDate, 1); 
    }
  }

  return {
    settlement: settlementDate.toISOString().split('T')[0],
    payment: paymentDate.toISOString().split('T')[0]
  };
}

function renderPayTable() {
  const tbody = document.getElementById('payTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  const totalCount = payOrders.length;
  const pickedCount = payOrders.filter(o => o.pickupDate).length;
  const unpickedCount = totalCount - pickedCount;

  if (document.getElementById('cnt-all')) 
    document.getElementById('cnt-all').innerText = `(${totalCount})`;
  if (document.getElementById('cnt-picked')) 
    document.getElementById('cnt-picked').innerText = `(${pickedCount})`;
  if (document.getElementById('cnt-unpicked')) 
    document.getElementById('cnt-unpicked').innerText = `(${unpickedCount})`;

  if (payOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#999; padding:20px;">☁️ 目前無訂單，請從 Excel 複製貼上</td></tr>`;
    return;
  }

  const filterEl = document.querySelector('input[name="statusFilter"]:checked');
  const filterVal = filterEl ? filterEl.value : 'all';

  // 取得搜尋框的文字（忽略大小寫）
  const searchInput = document.getElementById('orderSearch');
  const searchText = searchInput ? searchInput.value.trim().toLowerCase() : '';

  // 第一步：先過濾搜尋條件（訂單號/姓名/電話/物流單號）
  let filteredOrders = payOrders.filter(order => {
    if (!searchText) return true; // 沒有搜尋文字，顯示全部
    return (
      (order.no && order.no.toLowerCase().includes(searchText)) ||
      (order.name && order.name.toLowerCase().includes(searchText)) ||
      (order.phone && order.phone.toLowerCase().includes(searchText)) ||
      (order.trackingNum && order.trackingNum.toLowerCase().includes(searchText))
    );
  });

  // 第二步：再過濾狀態（全部/已取/未取）
  filteredOrders = filteredOrders.filter(order => {
    const isPicked = !!order.pickupDate;
    if (filterVal === 'picked') return isPicked;
    if (filterVal === 'unpicked') return !isPicked;
    return true;
  });

  // 用過濾後的訂單渲染表格，保留真實索引（用於批量操作）
  filteredOrders.forEach((order) => {
    const realIndex = payOrders.indexOf(order);
    const isPicked = !!order.pickupDate;

    // ★★★ 只顯示物流單號 ★★★
    let trackHtml = '<span style="color:#ccc;">-</span>';
    if (order.trackingNum) {
      trackHtml = `<span style="font-size:12px; color:#666;">${order.trackingNum}</span>`;
    }

    let statusHtml = '';

    if (order.pickupDate) {
      const calc = calculatePaymentDate(order.platform, order.pickupDate);
      statusHtml = `
        <div style="text-align:right">
          <button class="btn btn-success btn-sm" onclick="resetOrderStatus(${index})">
            ✅ 已取 (${order.pickupDate.slice(5)})
          </button>
          <div style="font-size:13px; color:#d63031; font-weight:bold; margin-top:4px;">
            💰 撥款: ${calc.payment}
          </div>
        </div>
      `;
    } else {
      statusHtml = `
        <div class="action-wrapper">
          <button class="btn btn-danger btn-sm" style="pointer-events: none;">
            📦 未取貨
          </button>
          <input type="date" 
                 class="hidden-date-input" 
                 onchange="updateOrderPickup(${index}, this.value)">
        </div>
      `;
    }

// ★★★ 根據平台設定顏色 ★★★
let platformColor = '#eee';
let platformTextColor = '#333';

if (order.platform && (order.platform.includes('7-11') || order.platform.includes('賣貨便'))) {
  platformColor = '#fe6601';
  platformTextColor = '#fff';
} else if (order.platform && (order.platform.includes('全家') || order.platform.includes('好賣'))) {
  platformColor = '#008cd6';
  platformTextColor = '#fff';
}

const tr = document.createElement('tr');
tr.innerHTML = `
    <td><input type="checkbox" class="pay-chk" data-idx="${realIndex}"></td>
  <td>
    <span style="font-size:15px; font-weight:700; color:#1f2937;">
      ${order.no}
    </span>
  </td>
  <td>${order.name}</td>
  <td>${order.phone}</td>
  <td>
    <span style="background:${platformColor}; color:${platformTextColor}; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600; display:inline-block;">
      ${order.platform}
    </span>
  </td>
  <td>${order.shipDate || '-'}</td>
  <td>${order.deadline || '-'}</td>
  <td>${trackHtml}</td>
  <td>${statusHtml}</td>
  <td>
    <button class="btn btn-secondary btn-sm" onclick="deleteOrder(${index})">
      ❌
    </button>
  </td>
`;

    tbody.appendChild(tr);
  });
}


// ★★★ 新增:複製物流單號功能 ★★★
function copyTrackingNumber(trackingNum) {
  navigator.clipboard.writeText(trackingNum).then(() => {
    showToast(`✅ 已複製: ${trackingNum}`);
  }).catch(() => {
    // 降級方案
    const textarea = document.createElement('textarea');
    textarea.value = trackingNum;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast(`✅ 已複製: ${trackingNum}`);
  });
}

// ★★★ 新增:顯示提示訊息 ★★★
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: #1f2937;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    font-size: 14px;
    animation: slideUp 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideDown 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

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

  let idx = { 
    no: 0, 
    name: 1, 
    phone: 2, 
    platform: 3, 
    store: 4, 
    shipDate: 5, 
    deadline: 6, 
    trackingNum: 7 
  };

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
    if (!trackingNum) continue;

    payOrders.push({
      no: (cols[idx.no] || '').trim(),
      name: (cols[idx.name] || '').trim(),
      phone: (cols[idx.phone] || '').trim(),
      platform: finalPlatform,
      store: (cols[idx.store] || '').trim(),
      shipDate: (cols[idx.shipDate] || '').trim(),
      deadline: (cols[idx.deadline] || '').trim(),
      trackingNum,
      pickupDate: null
      // ★★★ 移除了 trackingStatus ★★★
    });

    count++;
  }

  if (count > 0) {
    savePayOrders();
    renderPayTable();
    el.value = '';
    alert(`✅ 成功匯入 ${count} 筆訂單！`);
  } else {
    alert('⚠️ 沒有找到有效的訂單資料');
  }
}

function updateOrderPickup(idx, dateVal) {
  if (!dateVal) return;
  payOrders[idx].pickupDate = dateVal;
  savePayOrders();
  renderPayTable();
}

function resetOrderStatus(idx) {
  if (confirm('確定要重設為「未取貨」嗎？')) {
    payOrders[idx].pickupDate = null;
    savePayOrders();
    renderPayTable();
  }
}

function deleteOrder(idx) {
  if (confirm(`確定要刪除訂單「${payOrders[idx].no}」嗎？`)) {
    payOrders.splice(idx, 1);
    savePayOrders();
    renderPayTable();
  }
}

function batchDeleteOrders() {
  const checked = Array.from(document.querySelectorAll('.pay-chk:checked'));
  if (checked.length === 0) return alert('請先勾選要刪除的訂單');
  
  if (!confirm(`確定要刪除 ${checked.length} 筆訂單嗎？`)) return;

  const indices = checked.map(c => parseInt(c.dataset.idx)).sort((a, b) => b - a);
  indices.forEach(i => payOrders.splice(i, 1));
  
  savePayOrders();
  renderPayTable();
  alert(`✅ 已刪除 ${indices.length} 筆訂單`);
}

function exportToExcel() {
  if (payOrders.length === 0) return alert('目前沒有訂單資料');

  let csv = '訂單號,姓名,電話,平台,門市,出貨日,取貨期限,物流單號,取貨日,結帳日,撥款日\n';
  
  payOrders.forEach(o => {
    const calc = calculatePaymentDate(o.platform, o.pickupDate);
    csv += `${o.no},${o.name},${o.phone},${o.platform},${o.store},${o.shipDate},${o.deadline},${o.trackingNum},${o.pickupDate || ''},${calc.settlement},${calc.payment}\n`;
  });

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `訂單資料_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

// ★★★ 移除了所有 API 追蹤相關函數 ★★★
// - trackSelectedOrders()
// - trackAllOrders()
// - trackSingleOrder()
// - 51Tracking API 相關程式碼

// ============================================
// ★★★ 初始化 ★★★
// ============================================

// 先匯出函數到全域
window.importFromTextImpl = importFromTextImpl;
window.updateOrderPickup = updateOrderPickup;
window.resetOrderStatus = resetOrderStatus;
window.deleteOrder = deleteOrder;
window.batchDeleteOrders = batchDeleteOrders;
window.exportToExcel = exportToExcel;
window.savePayOrders = savePayOrders;
window.renderPayTable = renderPayTable;

// 監聽 Firebase 資料變化
onValue(payOrdersRef, (snapshot) => {
  const data = snapshot.val();
  payOrders = data ? (Array.isArray(data) ? data : Object.values(data)) : [];
  
  // ★★★ 重要:每次更新都要同步到 window ★★★
  window.payOrders = payOrders;
  
  renderPayTable();
  
  console.log('📊 訂單資料已更新:', {
    訂單數量: payOrders.length,
    已取貨: payOrders.filter(o => o.pickupDate).length,
    未取貨: payOrders.filter(o => !o.pickupDate).length
  });
});

// 初始化事件監聽
document.addEventListener('DOMContentLoaded', () => {
  const radios = document.querySelectorAll('input[name="statusFilter"]');
  radios.forEach(r => r.addEventListener('change', renderPayTable));
  
  console.log('✅ orders.js 初始化完成 (無 API 追蹤版本)');
  console.log('📦 已匯出到 window:', {
    payOrders: typeof window.payOrders,
    savePayOrders: typeof window.savePayOrders,
    renderPayTable: typeof window.renderPayTable
  });
});

