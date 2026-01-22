// orders.js - 51Tracking API v4 (備註欄位對應 note)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

console.log(`🚀 orders.js (51Tracking v4) Loaded at ${new Date().toLocaleTimeString()}`);

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

// ★★★ 51Tracking API 設定 ★★★
const TRACKING_API_KEY = 't2l6hoex-eb9y-znvr-k7sc-yckeosa72yfm';
const TRACKING_API_BASE = 'https://api.51tracking.com/v4';

// 僅支援 7-11 和全家
const carrierMap = {
  '7-11': 'qi-eleven',
  '賣貨便': 'qi-eleven',
  '全家': 'famiport',
  '好賣+': 'famiport'
};

const carrierNameMap = {
  'qi-eleven': '7-11',
  'famiport': '全家'
};

// ============================================
// ★★★ 檢查 HTTPS ★★★
// ============================================

function checkHTTPS() {
  if (window.location.protocol !== 'https:') {
    console.warn('⚠️ 警告: 當前網站使用 HTTP,51Tracking API 需要 HTTPS 才能正常運作!');
    return false;
  }
  return true;
}

// ============================================
// ★★★ 51Tracking API v4 函數 ★★★
// ============================================

/**
 * 創建追蹤單號 (備註存入 note)
 */
async function createTracking(trackingNumber, courierCode, orderInfo = {}) {
  if (!checkHTTPS()) {
    return { success: false, error: '需要 HTTPS 連線' };
  }

  try {
    const payload = {
      tracking_number: trackingNumber,
      courier_code: courierCode
    };

    if (orderInfo.order_number) payload.order_number = orderInfo.order_number;
    if (orderInfo.customer_name) payload.customer_name = orderInfo.customer_name;
    if (orderInfo.customer_sms) payload.customer_sms = orderInfo.customer_sms;
    if (orderInfo.customer_email) payload.customer_email = orderInfo.customer_email;
    if (orderInfo.note) payload.note = orderInfo.note;  // ✅ 備註存入 note

    const response = await fetch(`${TRACKING_API_BASE}/trackings/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Tracking-Api-Key': TRACKING_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (result.meta?.code === 200 || result.meta?.code === 4016) {
      console.log(`✅ 追蹤創建成功: ${trackingNumber}`);
      return { success: true, data: result.data };
    } else {
      console.warn(`⚠️ 創建失敗: ${trackingNumber}`, result);
      return { success: false, error: result.meta?.message || '未知錯誤' };
    }
  } catch (error) {
    console.error(`❌ API 錯誤:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * 批量查詢追蹤資訊
 */
async function batchGetTracking(trackingNumbers, courierCode) {
  if (!checkHTTPS()) {
    return { success: false, error: '需要 HTTPS 連線' };
  }

  try {
    const numbers = trackingNumbers.join(',');
    const url = `${TRACKING_API_BASE}/trackings/get?tracking_numbers=${numbers}&courier_code=${courierCode}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Tracking-Api-Key': TRACKING_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (result.meta?.code === 200) {
      return { 
        success: true, 
        data: result.data?.success || [],
        rejected: result.data?.rejected || []
      };
    } else {
      return { success: false, error: result.meta?.message };
    }
  } catch (error) {
    console.error('批量查詢錯誤:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 查詢單一追蹤資訊
 */
async function getTrackingInfo(trackingNumber, courierCode) {
  if (!checkHTTPS()) {
    return { success: false, error: '需要 HTTPS 連線' };
  }

  try {
    const url = `${TRACKING_API_BASE}/trackings/get?tracking_numbers=${trackingNumber}&courier_code=${courierCode}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Tracking-Api-Key': TRACKING_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (result.meta?.code === 200) {
      const successData = result.data?.success || [];
      if (successData.length > 0) {
        return { success: true, data: successData[0] };
      } else {
        const rejected = result.data?.rejected || [];
        if (rejected.length > 0) {
          return { 
            success: false, 
            error: `${rejected[0].rejectedMessage} (Code: ${rejected[0].rejectedCode})` 
          };
        }
        return { success: false, error: '查無資料' };
      }
    } else {
      return { success: false, error: result.meta?.message || '查詢失敗' };
    }
  } catch (error) {
    console.error('查詢錯誤:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 解析物流狀態
 */
function parseTrackingStatus(trackingData) {
  if (!trackingData) return { 
    status: '查無資料', 
    isDelivered: false, 
    deliveryDate: null,
    detail: '',
    note: ''
  };

  const deliveryStatus = trackingData.delivery_status;
  const latestEvent = trackingData.latest_event || '';
  const latestCheckpointTime = trackingData.latest_checkpoint_time;
  const substatus = trackingData.substatus || '';
  const statusInfo = trackingData.status_info || '';
  const note = trackingData.note || '';  // ✅ 讀取 note (備註)
  
  let statusText = '運送中';
  let statusEmoji = '🚚';
  let isDelivered = false;
  let deliveryDate = null;
  let detail = latestEvent || statusInfo;

  switch (deliveryStatus) {
    case 'delivered':
      statusText = '已配達';
      statusEmoji = '✅';
      isDelivered = true;
      deliveryDate = latestCheckpointTime;
      break;
      
    case 'transit':
      statusText = '運送中';
      statusEmoji = '🚚';
      if (substatus.includes('001')) statusText = '已攬收';
      else if (substatus.includes('002')) statusText = '運輸途中';
      else if (substatus.includes('003')) statusText = '到達門市';
      break;
      
    case 'pickup':
      statusText = '已取件';
      statusEmoji = '📦';
      isDelivered = true;
      deliveryDate = latestCheckpointTime;
      break;
      
    case 'undelivered':
      statusText = '配送失敗';
      statusEmoji = '❌';
      break;
      
    case 'expired':
      statusText = '超過期限';
      statusEmoji = '⏰';
      break;
      
    case 'pending':
      statusText = '待出貨';
      statusEmoji = '⏳';
      break;
      
    case 'exception':
      statusText = '異常';
      statusEmoji = '⚠️';
      break;
      
    case 'info_received':
      statusText = '資料已建立';
      statusEmoji = '📝';
      break;
      
    default:
      statusText = '查詢中';
      statusEmoji = '🔍';
  }

  return {
    status: `${statusEmoji} ${statusText}`,
    isDelivered,
    deliveryDate,
    detail,
    rawStatus: deliveryStatus,
    substatus,
    transitTime: trackingData.transit_time,
    note  // ✅ 回傳備註
  };
}

/**
 * 取得詳細軌跡
 */
function getTrackingHistory(trackingData) {
  const history = [];
  
  if (trackingData.destination_info?.trackinfo && 
      Array.isArray(trackingData.destination_info.trackinfo)) {
    trackingData.destination_info.trackinfo.forEach(track => {
      if (track && typeof track === 'object') {
        history.push({
          date: track.checkpoint_date || '',
          status: track.checkpoint_delivery_status || '',
          substatus: track.checkpoint_delivery_substatus || '',
          detail: track.tracking_detail || '',
          location: track.location || '',
          city: track.city || '',
          state: track.state || '',
          zip: track.zip || ''
        });
      }
    });
  }
  
  if (trackingData.origin_info?.trackinfo && 
      Array.isArray(trackingData.origin_info.trackinfo)) {
    trackingData.origin_info.trackinfo.forEach(track => {
      if (track && typeof track === 'object') {
        history.push({
          date: track.checkpoint_date || '',
          status: track.checkpoint_delivery_status || '',
          substatus: track.checkpoint_delivery_substatus || '',
          detail: track.tracking_detail || '',
          location: track.location || '',
          city: track.city || '',
          state: track.state || '',
          zip: track.zip || ''
        });
      }
    });
  }
  
  return history.sort((a, b) => {
    if (!a.date || !b.date) return 0;
    return new Date(b.date) - new Date(a.date);
  });
}

// ============================================
// ★★★ 原有功能 ★★★
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

  if (platform && platform.includes('7-11')) {
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

    let trackHtml = '<span style="color:#ccc;">-</span>';

    if (order.trackingStatus) {
      let trackColor = '#007bff';
      
      if (order.trackingStatus.includes('✅') || order.trackingStatus.includes('已配達') || order.trackingStatus.includes('已取件')) {
        trackColor = '#28a745';
      } else if (order.trackingStatus.includes('❌') || order.trackingStatus.includes('失敗')) {
        trackColor = '#dc3545';
      } else if (order.trackingStatus.includes('⚠️') || order.trackingStatus.includes('異常')) {
        trackColor = '#ffc107';
      } else if (order.trackingStatus.includes('⏰')) {
        trackColor = '#dc3545';
      } else if (order.trackingStatus.includes('🚚') || order.trackingStatus.includes('運送')) {
        trackColor = '#17a2b8';
      } else if (order.trackingStatus.includes('到達門市')) {
        trackColor = '#28a745';
      }
      
      trackHtml = `<span style="font-size:12px; color:${trackColor}; font-weight:bold;">${order.trackingStatus}</span>`;
      
      if (order.trackingDetail) {
        const shortDetail = order.trackingDetail.length > 20 ? 
          order.trackingDetail.substring(0, 20) + '...' : 
          order.trackingDetail;
        trackHtml += `<br><span style="font-size:10px; color:#999;" title="${order.trackingDetail}">📍 ${shortDetail}</span>`;
      }
    }

    // ✅ 顯示物流單號和備註
    const subNoHtml = order.trackingNum ? `<br><span style="font-size:10px; color:#999;">🚚 ${order.trackingNum}</span>` : '';
    const storeHtml = order.store ? `<br><span style="font-size:10px; color:#666; font-weight:600;">📝 ${order.store}</span>` : '';
    
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
      <td><span style="background:${order.platform === '7-11' ? '#ff6b00' : '#00a650'}; color:white; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">${order.platform}</span>${storeHtml}</td>
      <td>${order.shipDate || '-'}</td>
      <td>${order.deadline || '-'}</td>
      <td>${trackHtml} ${subNoHtml}</td>
      <td>${statusHtml}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewTrackingDetail(${index})" title="查看詳細軌跡">🔍</button>
        <button class="btn btn-secondary btn-sm" onclick="deleteOrder(${index})">❌</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

/**
 * 查看物流詳細軌跡
 */
window.viewTrackingDetail = async function(idx) {
  const order = payOrders[idx];
  if (!order || !order.trackingNum) {
    return alert('此訂單無物流單號');
  }

  if (!checkHTTPS()) {
    return alert('⚠️ 需要 HTTPS 連線才能查詢物流資訊\n\n請確保網站使用 https:// 開頭');
  }

  const carrierCode = order.courierCode || carrierMap[order.platform] || 'qi-eleven';
  
  const loadingDiv = document.createElement('div');
  loadingDiv.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:white; padding:30px; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.3); z-index:9999; text-align:center;';
  loadingDiv.innerHTML = '<div style="font-size:24px; margin-bottom:10px;">🔍</div><div>正在查詢詳細軌跡...</div>';
  document.body.appendChild(loadingDiv);
  
  const result = await getTrackingInfo(order.trackingNum, carrierCode);
  
  loadingDiv.remove();
  
  if (result.success && result.data) {
    const history = getTrackingHistory(result.data);
    const note = result.data.note || order.store || '';  // ✅ 顯示備註
    
    let html = `<div style="max-height:500px; overflow-y:auto;">`;
    html += `<h3 style="margin-bottom:20px;">📦 ${order.trackingNum}</h3>`;
    html += `<div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:20px;">`;
    html += `<p style="margin:5px 0;"><b>物流商:</b> ${order.platform} (${carrierCode})</p>`;
    if (note) {
      html += `<p style="margin:5px 0;"><b>📝 備註:</b> ${note}</p>`;  // ✅ 顯示備註
    }
    html += `<p style="margin:5px 0;"><b>當前狀態:</b> ${order.trackingStatus}</p>`;
    if (result.data.transit_time) {
      html += `<p style="margin:5px 0;"><b>運送天數:</b> ${result.data.transit_time} 天</p>`;
    }
    html += `</div>`;
    html += `<h4 style="margin-bottom:15px;">物流軌跡:</h4>`;
    
    if (history.length > 0) {
      history.forEach(track => {
        let statusColor = '#007bff';
        if (track.status === 'delivered') statusColor = '#28a745';
        else if (track.status === 'exception') statusColor = '#dc3545';
        else if (track.status === 'transit') statusColor = '#17a2b8';
        
        html += `<div style="margin-bottom:15px; padding:12px; background:#f8f9fa; border-left:4px solid ${statusColor}; border-radius:4px;">`;
        html += `<div style="font-size:12px; color:#666; margin-bottom:5px;">${track.date}</div>`;
        html += `<div style="font-weight:bold; margin:5px 0; color:#333;">${track.detail}</div>`;
        if (track.location) {
          html += `<div style="font-size:12px; color:#999;">📍 ${track.location}</div>`;
        }
        html += `</div>`;
      });
    } else {
      html += `<p style="color:#999; text-align:center; padding:20px;">暫無軌跡資訊</p>`;
    }
    
    html += `</div>`;
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999;';
    modal.innerHTML = `<div style="background:white; padding:30px; border-radius:12px; max-width:700px; width:90%; max-height:80vh; overflow:hidden; display:flex; flex-direction:column;">
      ${html}
      <button onclick="this.closest('div[style*=fixed]').remove()" style="margin-top:20px; padding:12px 24px; background:#007bff; color:white; border:none; border-radius:6px; cursor:pointer; font-size:14px; font-weight:bold;">關閉</button>
    </div>`;
    document.body.appendChild(modal);
    
  } else {
    alert(`❌ 查詢失敗: ${result.error}`);
  }
};

/**
 * 批量匯入 (備註存入 note)
 */
function importFromTextImpl() {
  const el = document.getElementById('importText');
  if (!el) return;

  const txt = el.value?.trim();
  if (!txt) return alert('請先貼上資料喔!');

  const lines = txt.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return;

  const splitCols = (line) => line.split(/[\t]+/).map(s => s.trim());
  const header = splitCols(lines[0]);

  const trackingFields = new Set([
    'tracking_number', 'courier_code', 'order_number', 
    'customer_name', 'customer_sms', 'note', 'store_name',
    '物流單號', '物流商簡碼', '訂單號', '客戶名稱', '客戶電話', '門市名稱', '備註'
  ]);

  const isHeader = header.some(h => trackingFields.has(h));

  let idx = {
    trackingNum: 0,
    courierCode: 1,
    orderNo: 2,
    name: 3,
    phone: 4,
    store: 5  // ✅ 備註欄位
  };

  if (isHeader) {
    const map = {};
    header.forEach((h, i) => { map[h] = i; });
    
    idx = {
      trackingNum: map['tracking_number'] ?? map['物流單號'] ?? 0,
      courierCode: map['courier_code'] ?? map['物流商簡碼'] ?? 1,
      orderNo: map['order_number'] ?? map['訂單號'] ?? 2,
      name: map['customer_name'] ?? map['客戶名稱'] ?? 3,
      phone: map['customer_sms'] ?? map['客戶電話'] ?? 4,
      store: map['note'] ?? map['store_name'] ?? map['門市名稱'] ?? map['備註'] ?? 5
    };
  }

  const start = isHeader ? 1 : 0;
  let count = 0;
  let trackingList = [];

  for (let i = start; i < lines.length; i++) {
    const cols = splitCols(lines[i]);
    if (cols.length < 2) continue;

    const trackingNum = (cols[idx.trackingNum] || '').trim();
    const courierCode = (cols[idx.courierCode] || '').trim();
    
    if (!trackingNum || !courierCode) continue;
    if (courierCode !== 'qi-eleven' && courierCode !== 'famiport') {
      console.warn(`第 ${i + 1} 行: 不支援的物流商 ${courierCode},已跳過`);
      continue;
    }

    const platformName = carrierNameMap[courierCode];
    const orderNo = (cols[idx.orderNo] || '').trim();
    const name = (cols[idx.name] || '').trim();
    const phone = (cols[idx.phone] || '').trim();
    const storeName = (cols[idx.store] || '').trim();  // ✅ 備註

    payOrders.push({
      no: orderNo || `#${trackingNum.slice(-4)}`,
      name: name || '未填寫',
      phone: phone || '',
      platform: platformName,
      store: storeName || '',  // ✅ 儲存備註
      shipDate: new Date().toISOString().split('T')[0],
      deadline: '',
      trackingNum: trackingNum,
      courierCode: courierCode,
      pickupDate: null,
      trackingStatus: '⏳ 待查詢',
      trackingDetail: ''
    });

    trackingList.push({
      tracking_number: trackingNum,
      courier_code: courierCode,
      order_number: orderNo,
      customer_name: name,
      customer_sms: phone,
      note: storeName  // ✅ 備註傳給 API 的 note 欄位
    });

    count++;
  }

  if (count > 0) {
    savePayOrders();
    
    if (confirm(`✅ 成功匯入 ${count} 筆資料!\n\n是否立即使用 51Tracking API 創建追蹤?`)) {
      batchCreateAndTrack(trackingList);
    } else {
      alert(`✅ 已匯入 ${count} 筆訂單\n稍後可使用「追蹤貨況」按鈕查詢`);
    }
    
    el.value = '';
    if (typeof switchTab === 'function') {
      switchTab('pay-sub-orders');
    }
  } else {
    alert('❌ 沒有匯入任何資料\n\n請確認:\n1. 物流單號欄有值\n2. 物流商簡碼為 qi-eleven 或 famiport\n3. 資料格式為 Tab 分隔');
  }
}

/**
 * 批量創建追蹤 (包含備註)
 */
async function batchCreateAndTrack(trackingList) {
  if (!checkHTTPS()) {
    return alert('⚠️ 需要 HTTPS 連線才能使用 51Tracking API\n\n請確保網站使用 https:// 開頭');
  }

  alert(`🚀 開始批量創建 ${trackingList.length} 筆追蹤...\n請稍候片刻`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < trackingList.length; i++) {
    const item = trackingList[i];
    
    try {
      const result = await createTracking(item.tracking_number, item.courier_code, {
        order_number: item.order_number,
        customer_name: item.customer_name,
        customer_sms: item.customer_sms,
        note: item.note  // ✅ 傳送備註
      });
      
      if (result.success) {
        successCount++;
        
        const order = payOrders.find(o => o.trackingNum === item.tracking_number);
        if (order) {
          order.trackingStatus = '✅ 已建立追蹤';
        }
      } else {
        failCount++;
        
        const order = payOrders.find(o => o.trackingNum === item.tracking_number);
        if (order) {
          order.trackingStatus = `❌ ${result.error || '建立失敗'}`;
        }
      }

      if ((i + 1) % 5 === 0) {
        renderPayTable();
      }

      await new Promise(resolve => setTimeout(resolve, 600));

    } catch (error) {
      console.error(`創建追蹤失敗: ${item.tracking_number}`, error);
      failCount++;
    }
  }

  savePayOrders();
  renderPayTable();

  alert(`✅ 批量創建完成!\n\n成功: ${successCount} 筆\n失敗: ${failCount} 筆\n\n現在可以使用「追蹤貨況」查詢最新狀態`);
}

/**
 * 查詢物流狀態 (同步備註)
 */
async function checkAllTrackingImpl() {
  const indices = Array.from(document.querySelectorAll('.pay-chk:checked'))
    .map(c => parseInt(c.dataset.idx, 10));

  if (indices.length === 0) return alert('請先勾選要查詢的訂單');
  
  if (!checkHTTPS()) {
    return alert('⚠️ 需要 HTTPS 連線才能使用 51Tracking API\n\n請確保網站使用 https:// 開頭');
  }

  if (!confirm(`準備使用 51Tracking API 查詢 ${indices.length} 筆訂單貨況...`)) return;

  indices.forEach(i => { 
    if (payOrders[i]) payOrders[i].trackingStatus = "⏳ 查詢中..."; 
  });
  renderPayTable();

  let successCount = 0;
  let failCount = 0;

  const groupedByCourier = { 'qi-eleven': [], 'famiport': [] };
  
  indices.forEach(idx => {
    const order = payOrders[idx];
    if (!order) return;
    
    const courierCode = order.courierCode || carrierMap[order.platform] || 'qi-eleven';
    if (groupedByCourier[courierCode]) {
      groupedByCourier[courierCode].push({ idx, order });
    }
  });

  for (const [courierCode, items] of Object.entries(groupedByCourier)) {
    if (items.length === 0) continue;
    
    const trackingNumbers = items.map(item => item.order.trackingNum);
    
    try {
      const result = await batchGetTracking(trackingNumbers, courierCode);
      
      if (result.success && result.data) {
        result.data.forEach(trackData => {
          const item = items.find(i => i.order.trackingNum === trackData.tracking_number);
          if (!item) return;
          
          const parsed = parseTrackingStatus(trackData);
          item.order.trackingStatus = parsed.status;
          item.order.trackingDetail = parsed.detail;
          
          // ✅ 同步備註 (如果 API 有回傳 note)
          if (parsed.note && !item.order.store) {
            item.order.store = parsed.note;
          }
          
          if (parsed.isDelivered && !item.order.pickupDate && parsed.deliveryDate) {
            item.order.pickupDate = parsed.deliveryDate.split('T')[0];
          }
          
          successCount++;
        });

        if (result.rejected && result.rejected.length > 0) {
          result.rejected.forEach(rejected => {
            const item = items.find(i => i.order.trackingNum === rejected.tracking_number);
            if (item) {
              item.order.trackingStatus = `❌ ${rejected.rejectedMessage}`;
              failCount++;
            }
          });
        }
      } else {
        items.forEach(item => {
          item.order.trackingStatus = "❌ 查詢失敗";
          failCount++;
        });
      }
      
      renderPayTable();
      await new Promise(resolve => setTimeout(resolve, 600));
      
    } catch (error) {
      console.error(`查詢失敗: ${courierCode}`, error);
      items.forEach(item => {
        item.order.trackingStatus = "❌ 查詢失敗";
        failCount++;
      });
    }
  }

  savePayOrders();
  alert(`✅ 查詢完成!\n\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`);
}

// ============================================
// ★★★ 其他功能函數 ★★★
// ============================================

window.importFromText = importFromTextImpl;
window.ImportFromText = importFromTextImpl;
window.renderPayTable = renderPayTable;
window.checkAllTracking = checkAllTrackingImpl;

window.addNewOrder = function () {
  const no = document.getElementById('addOrderNo').value;
  const name = document.getElementById('addName').value;
  if (!no || !name) return alert('請填寫完整資訊');

  let p = document.getElementById('addPlatform').value;
  if (p.includes('賣貨便') || p.includes('7-11')) p = '7-11';
  if (p.includes('好賣') || p.includes('全家')) p = '全家';

  if (p !== '7-11' && p !== '全家') {
    return alert('⚠️ 本系統僅支援 7-11 和全家!');
  }

  payOrders.push({
    no: no.startsWith('#') ? no : '#' + no,
    name,
    phone: document.getElementById('addPhone').value,
    platform: p,
    store: document.getElementById('addStore')?.value || '',  // ✅ 備註
    shipDate: document.getElementById('addShipDate').value,
    deadline: document.getElementById('addDeadline').value,
    trackingNum: '',
    courierCode: carrierMap[p],
    pickupDate: null,
    trackingStatus: '',
    trackingDetail: ''
  });

  savePayOrders();
  alert('✅ 新增成功!');
  
  document.getElementById('addOrderNo').value = '';
  document.getElementById('addName').value = '';
  document.getElementById('addPhone').value = '';
  if (document.getElementById('addStore')) document.getElementById('addStore').value = '';
  document.getElementById('addShipDate').value = '';
  document.getElementById('addDeadline').value = '';
};

window.deleteOrder = function(idx) {
  if (!confirm('確定要刪除這筆訂單嗎?')) return;
  payOrders.splice(idx, 1);
  savePayOrders();
};

window.updateOrderPickup = function(idx, date) {
  if (payOrders[idx]) {
    payOrders[idx].pickupDate = date;
    savePayOrders();
  }
};

window.resetOrderStatus = function(idx) {
  if (payOrders[idx]) {
    payOrders[idx].pickupDate = null;
    savePayOrders();
  }
};

window.toggleSelectAllPay = function() {
  const checked = document.getElementById('selectAllPay').checked;
  document.querySelectorAll('.pay-chk').forEach(c => c.checked = checked);
};

window.batchDeleteOrders = function() {
  const indices = Array.from(document.querySelectorAll('.pay-chk:checked'))
    .map(c => parseInt(c.dataset.idx, 10))
    .sort((a, b) => b - a);

  if (indices.length === 0) return alert('請先勾選要刪除的訂單');
  if (!confirm(`確定要刪除 ${indices.length} 筆訂單嗎?`)) return;

  indices.forEach(i => payOrders.splice(i, 1));
  savePayOrders();
};

window.batchSetDate = function() {
  const date = document.getElementById('batchDateInput').value;
  if (!date) return alert('請先選擇日期');

  const indices = Array.from(document.querySelectorAll('.pay-chk:checked'))
    .map(c => parseInt(c.dataset.idx, 10));

  if (indices.length === 0) return alert('請先勾選訂單');

  indices.forEach(i => {
    if (payOrders[i]) payOrders[i].pickupDate = date;
  });

  savePayOrders();
  alert(`✅ 已將 ${indices.length} 筆訂單設為 ${date}`);
};

window.doCalc = function() {
  const platform = document.getElementById('calcPlatform').value;
  const dateStr = document.getElementById('calcDate').value;
  if (!dateStr) return alert('請選擇取貨日期');

  const result = calculatePaymentDate(platform, dateStr);
  const resultDiv = document.getElementById('calcResult');
  
  if (resultDiv) {
    resultDiv.innerHTML = `
      <div style="text-align:center;">
        <div style="font-size:16px; color:#666; margin-bottom:10px;">📅 結算日: ${result.settlement}</div>
        <div style="font-size:24px; color:#00b894; font-weight:bold;">💰 撥款日: ${result.payment}</div>
      </div>
    `;
    resultDiv.style.display = 'block';
  }
};

window.exportOrdersExcel = function() {
  if (typeof XLSX === 'undefined') {
    return alert('Excel 匯出功能載入中，請稍後再試');
  }

  if (payOrders.length === 0) {
    return alert('目前沒有訂單可以匯出');
  }

  const exportData = payOrders.map(order => {
    const calc = order.pickupDate ? calculatePaymentDate(order.platform, order.pickupDate) : { settlement: '-', payment: '-' };
    
    return {
      '訂單號': order.no,
      '姓名': order.name,
      '電話': order.phone,
      '平台': order.platform,
      '備註': order.store || '-',  // ✅ 匯出備註
      '出貨日': order.shipDate || '-',
      '取貨期限': order.deadline || '-',
      '物流單號': order.trackingNum || '-',
      '物流狀態': order.trackingStatus || '-',
      '取貨日': order.pickupDate || '未取貨',
      '結算日': calc.settlement,
      '撥款日': calc.payment
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '訂單列表');

  const fileName = `訂單列表_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
  
  alert(`✅ 已匯出 ${payOrders.length} 筆訂單`);
};

// Firebase 監聽
onValue(payOrdersRef, (snapshot) => {
  const data = snapshot.val();
  if (Array.isArray(data)) {
    payOrders = data;
  } else {
    payOrders = [];
  }
  renderPayTable();
});

if (checkHTTPS()) {
  console.log('✅ orders.js (51Tracking v4) 載入完成');
  console.log('✅ API Key 已設定');
  console.log('✅ 備註欄位將儲存至 note 欄位');
} else {
  console.warn('⚠️ orders.js 載入完成,但需要 HTTPS 才能使用 51Tracking API');
}
