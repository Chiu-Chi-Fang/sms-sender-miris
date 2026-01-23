// ============================================
// sms.js - 完整修正版 (含預覽確認功能)
// ============================================

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

console.log('🚀 sms.js 開始載入...');

// ============================================
// ★★★ Firebase 初始化 ★★★
// ============================================

let app;
if (getApps().length === 0) {
  const firebaseConfig = {
    apiKey: "AIzaSyDcKclyNssDs08E0DIwfrc7lzq3QQL4QS8",
    authDomain: "sms-miris.firebaseapp.com",
    databaseURL: "https://sms-miris-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "sms-miris",
    storageBucket: "sms-miris.firebasestorage.app",
    messagingSenderId: "340097404227",
    appId: "1:340097404227:web:554901219608cbed42f3f6"
  };
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase 已初始化 (sms.js)');
} else {
  app = getApp();
  console.log('✅ 使用現有的 Firebase 實例 (sms.js)');
}

const db = getDatabase(app);

let smsOrders = [];
let templates = [];
let editingIndex = -1;

const defaultTemplates = [
  { 
    name: "到貨通知(已付款)", 
    content: "【包裹取件通知】\n{name} 您好\n您在美莉的家訂購的商品 {no}\n已抵達超商(門市:{platform} {store})\n請您務必攜帶證件前往門市取貨\n到期日:{deadline}\n美莉的家感謝您。" 
  },
  { 
    name: "貨到付款 第一天到", 
    content: "【包裹取件通知】\n{name} 您好\n您在美莉的家訂購的商品 {no}\n已抵達超商(門市:{platform} {store})\n請您務必於【{deadline}】前完成取貨付款。\n美莉的家感謝您。" 
  },
  { 
    name: "貨到付款 剩3天", 
    content: "【取件剩餘3日通知】\n{name} 您好\n您在美莉的家訂購的商品 {no}\n超商門市:{platform} {store}\n請您務必於【{deadline}】前完成取貨付款。\n以避免包裹遭退回,影響您未來的購物權益。" 
  },
  { 
    name: "貨到付款 最後2天", 
    content: "【取件剩餘2日通知】\n{name} 您好\n您在美莉的家訂購的商品 {no}\n超商門市:{platform} {store}\n請您務必於【{deadline}】前完成取貨付款。\n以避免包裹遭退回,影響您未來的購物權益。" 
  },
  { 
    name: "貨到付款 最後一天", 
    content: "【取件最後1日通知】\n{name} 您好\n您在美莉的家訂購的商品 {no}\n即將被門市逾期未取退回\n超商門市:{platform} {store}\n請您務必於【今天23:00】前完成取貨付款。\n如包裹遭退回,便將註記門號資訊於電商平台,影響您未來購物權益" 
  }
];


const ordersRef = ref(db, 'sms_orders');
const tplRef = ref(db, 'templates');

// ==========================================
// ★★★ 1. 監聽 Firebase 資料 ★★★
// ==========================================

onValue(ordersRef, (snapshot) => {
  const data = snapshot.val();
  smsOrders = data || [];
  console.log('📨 SMS 訂單已更新:', smsOrders.length);
  renderSmsList();
});

onValue(tplRef, (snapshot) => {
  const data = snapshot.val();
  templates = data || defaultTemplates;
  console.log('📝 範本已更新:', templates.length);
  renderTemplates();
  updateTemplateSelect();
});

// ==========================================
// ★★★ 2. 接收訂單 (從 orders.js 推送) ★★★
// ==========================================

window.pushOrdersToSMS = function(indices) {
  console.log('📥 收到推送請求，索引:', indices);
  
  if (!window.payOrders || !Array.isArray(window.payOrders)) {
    alert('❌ 系統錯誤：訂單資料未載入');
    console.error('payOrders 未定義:', window.payOrders);
    return;
  }

  let count = 0;
  
  indices.forEach(idx => {
    const order = window.payOrders[idx];
    
    if (!order) {
      console.warn(`找不到訂單索引 ${idx}`);
      return;
    }

    const exists = smsOrders.find(o => o.no === order.no);
    if (exists) {
      console.log(`訂單 ${order.no} 已存在，跳過`);
      return;
    }

    smsOrders.push({
      no: order.no,
      name: order.name,
      phone: order.phone,
      deadline: order.deadline,
      store: order.store || '',
      platform: order.platform || '',
      addedAt: new Date().toISOString()
    });
    
    count++;
    console.log(`✅ 新增 SMS 訂單: ${order.no}`);
  });

  if (count > 0) {
    set(ordersRef, smsOrders);
    alert(`✅ 已將 ${count} 筆訂單加入 SMS 待發送名單`);
  } else {
    alert('ℹ️ 所有訂單都已在 SMS 名單中');
  }
};

// 保留舊版函數名稱以相容性
window.receiveOrdersFromPay = function(orderList) {
  console.log('📥 收到訂單 (舊版):', orderList);
  let count = 0;
  orderList.forEach(newOrd => {
    const exists = smsOrders.find(o => o.no === newOrd.no);
    if (!exists) {
      smsOrders.push({
        no: newOrd.no,
        name: newOrd.name,
        phone: newOrd.phone,
        deadline: newOrd.deadline,
        store: newOrd.store || '',
        platform: newOrd.platform || '',
        addedAt: new Date().toISOString()
      });
      count++;
    }
  });
  if (count > 0) {
    set(ordersRef, smsOrders);
    console.log(`✅ 新增 ${count} 筆 SMS 訂單`);
  }
};

window.removeSMSOrder = function(orderNo) {
  const initialLen = smsOrders.length;
  smsOrders = smsOrders.filter(o => o.no !== orderNo);
  if (smsOrders.length !== initialLen) {
    set(ordersRef, smsOrders);
    console.log(`🗑️ 已移除訂單: ${orderNo}`);
  }
};

// ==========================================
// ★★★ 3. 渲染 SMS 列表 ★★★
// ==========================================

function renderSmsList() {
  const container = document.getElementById('smsListContainer');
  if (!container) {
    console.warn('⚠️ 找不到 #smsListContainer');
    return;
  }

  if (smsOrders.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#ccc;">目前沒有待發送名單</div>';
    return;
  }

  container.innerHTML = smsOrders.map((o, idx) => {
    const platformText = o.platform || '平台未指定';
    const storeText = o.store || '門市未指定';

    return `
      <div class="sms-card">
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
          <strong>
            <input type="checkbox" class="sms-chk" value="${idx}"> 
            ${o.name}
          </strong>
          <button class="btn btn-sm btn-secondary" onclick="deleteSmsOrder(${idx})">🗑️</button>
        </div>
        <div style="font-size:13px; color:#666;">
          ${o.phone} | ${o.no} <br>
          <span style="color:#2980b9; font-weight:bold;">${platformText}</span> ${storeText} 
          <span style="font-size:12px; color:#999;">(${o.deadline || '無期限'})</span>
        </div>
      </div>
    `;
  }).join('');

  console.log('✅ SMS 列表已渲染');
}

// ==========================================
// ★★★ 4. 範本管理 ★★★
// ==========================================

function renderTemplates() {
  const container = document.getElementById('templateListContainer');
  if (!container) {
    console.warn('⚠️ 找不到 #templateListContainer');
    return;
  }

  container.innerHTML = templates.map((t, i) => `
    <div style="border-bottom:1px solid #eee; padding:10px; display:flex; justify-content:space-between; align-items:start;">
      <div style="flex:1;">
        <div style="font-weight:bold; color:#333;">${t.name}</div>
        <div style="font-size:12px; color:#666; margin-top:4px; white-space:pre-wrap;">${t.content}</div>
      </div>
      <div style="display:flex; gap:5px; margin-left:10px;">
        <button class="btn btn-sm btn-warning" onclick="editTemplate(${i})">✏️</button>
        <button class="btn btn-sm btn-secondary" onclick="deleteTemplate(${i})">🗑️</button>
      </div>
    </div>
  `).join('');

  console.log('✅ 範本列表已渲染');
}

window.editTemplate = function(idx) {
  editingIndex = idx;
  const t = templates[idx];
  document.getElementById('tplNameInput').value = t.name;
  document.getElementById('tplContentInput').value = t.content;
  document.getElementById('tplNameInput').focus();
  document.querySelector('#sms-sub-tpl .btn-primary').innerText = "💾 更新範本";
  console.log(`✏️ 編輯範本 ${idx}:`, t.name);
};

window.saveTemplate = function() {
  const name = document.getElementById('tplNameInput').value.trim();
  const content = document.getElementById('tplContentInput').value.trim();

  if (!name || !content) {
    alert('⚠️ 名稱和內容不能為空！');
    return;
  }

  if (editingIndex >= 0) {
    templates[editingIndex] = { name, content };
    alert('✅ 範本已更新！');
    console.log('✅ 更新範本:', name);
  } else {
    templates.push({ name, content });
    alert('✅ 新範本已建立！');
    console.log('✅ 新增範本:', name);
  }

  set(tplRef, templates);
  window.clearTemplateInput();
};

window.deleteTemplate = function(idx) {
  if (confirm('確定要刪除這個範本嗎？')) {
    const deletedName = templates[idx].name;
    templates.splice(idx, 1);
    set(tplRef, templates);
    console.log('🗑️ 刪除範本:', deletedName);
  }
};

window.clearTemplateInput = function() {
  editingIndex = -1;
  document.getElementById('tplNameInput').value = '';
  document.getElementById('tplContentInput').value = '';
  document.querySelector('#sms-sub-tpl .btn-primary').innerText = "💾 儲存範本";
};

function updateTemplateSelect() {
  const sel = document.getElementById('smsTemplateSelect');
  if (!sel) {
    console.warn('⚠️ 找不到 #smsTemplateSelect');
    return;
  }

  const currentVal = sel.value;
  sel.innerHTML = '<option value="">-- 請選擇範本 --</option>' +
    templates.map((t, i) => `<option value="${i}">${t.name}</option>`).join('');

  if (currentVal && templates[currentVal]) {
    sel.value = currentVal;
  }

  console.log('✅ 範本選單已更新');
}

window.previewTemplate = function() {
  const idx = document.getElementById('smsTemplateSelect').value;
  const previewBox = document.getElementById('smsPreviewBox');
  
  if (idx === "") {
    previewBox.value = '';
    return;
  }
  
  const tpl = templates[idx];
  previewBox.value = tpl.content;
  console.log('👁️ 預覽範本:', tpl.name);
};

window.resetDefaultTemplates = function() {
  if (confirm('重置將恢復預設範本，您自訂的範本會消失，確定嗎？')) {
    set(tplRef, defaultTemplates);
    alert('✅ 已重置為預設範本！');
    console.log('🔄 已重置範本');
  }
};

window.deleteSmsOrder = function(idx) {
  const deletedOrder = smsOrders[idx];
  smsOrders.splice(idx, 1);
  set(ordersRef, smsOrders);
  console.log('🗑️ 刪除 SMS 訂單:', deletedOrder.no);
};

// ==========================================
// ★★★ 5. 發送 SMS (含預覽確認) ★★★
// ==========================================

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}/${d}`;
}

window.sendSelectedSMS = function() {
  const chks = document.querySelectorAll('.sms-chk:checked');
  if (chks.length === 0) {
    alert('⚠️ 請先勾選名單');
    return;
  }

  const rawContent = document.getElementById('smsPreviewBox').value;
  if (!rawContent) {
    alert('⚠️ 內容不能為空，請先選擇範本');
    return;
  }

  console.log(`📤 準備發送 ${chks.length} 則簡訊`);

  // ★★★ 產生所有簡訊預覽 ★★★
  const messages = [];
  chks.forEach(chk => {
    const idx = parseInt(chk.value);
    const order = smsOrders[idx];
    const shortDeadline = formatShortDate(order.deadline);

    let finalMsg = rawContent
      .replace(/{name}/g, order.name || '')
      .replace(/{customerName}/g, order.name || '')
      .replace(/{no}/g, order.no || '')
      .replace(/{orderNumber}/g, order.no || '')
      .replace(/{deadline}/g, shortDeadline)
      .replace(/{pickupDeadline}/g, shortDeadline)
      .replace(/{storeName}/g, order.store || '')
      .replace(/{store}/g, order.store || '')
      .replace(/{storeType}/g, order.platform || '')
      .replace(/{platform}/g, order.platform || '');

    messages.push({
      order: order,
      message: finalMsg
    });
  });

  // ★★★ 顯示預覽確認視窗 ★★★
  showSMSPreviewModal(messages);
};

// ★★★ 預覽確認視窗 ★★★
function showSMSPreviewModal(messages) {
  const previewHTML = messages.map((item, index) => `
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #f8f9fa;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <strong style="color: #2c3e50;">📱 ${item.order.name} (${item.order.phone})</strong>
        <span style="font-size: 12px; color: #7f8c8d;">${index + 1}/${messages.length}</span>
      </div>
      <div style="background: white; padding: 12px; border-radius: 6px; border-left: 3px solid #3498db; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${item.message}</div>
      <div style="margin-top: 8px; font-size: 12px; color: #95a5a6;">
        訂單: ${item.order.no} | ${item.order.platform} ${item.order.store}
      </div>
    </div>
  `).join('');

  const modal = document.createElement('div');
  modal.id = 'smsPreviewModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  modal.innerHTML = `
    <div style="background: white; border-radius: 16px; width: 90%; max-width: 600px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
      <div style="padding: 20px 25px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 18px; color: #2c3e50;">📋 簡訊預覽確認</h3>
        <button onclick="closeSMSPreviewModal()" style="background: none; border: none; font-size: 24px; color: #95a5a6; cursor: pointer; padding: 0; width: 30px; height: 30px; line-height: 1;">&times;</button>
      </div>
      <div style="padding: 20px 25px; overflow-y: auto; flex: 1;">
        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 13px; color: #856404;">
          ⚠️ 請仔細檢查每則簡訊內容，確認無誤後再點擊「確認發送」
        </div>
        ${previewHTML}
      </div>
      <div style="padding: 20px 25px; border-top: 1px solid #e2e8f0; display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="closeSMSPreviewModal()" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; color: #666;">
          ❌ 取消
        </button>
        <button onclick="confirmSendSMS()" style="padding: 10px 20px; border: none; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
          ✅ 確認發送 (${messages.length} 則)
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  window.pendingSMSMessages = messages;
}

// ★★★ 關閉預覽視窗 ★★★
window.closeSMSPreviewModal = function() {
  const modal = document.getElementById('smsPreviewModal');
  if (modal) {
    modal.remove();
  }
  window.pendingSMSMessages = null;
};

// ★★★ 確認發送 ★★★
window.confirmSendSMS = function() {
  const messages = window.pendingSMSMessages;
  
  if (!messages || messages.length === 0) {
    alert('❌ 沒有待發送的簡訊');
    return;
  }

  console.log(`📤 開始發送 ${messages.length} 則簡訊`);

  messages.forEach((item, index) => {
    setTimeout(() => {
      const url = `sms:${item.order.phone}?body=${encodeURIComponent(item.message)}`;
      console.log(`📱 發送給 ${item.order.name} (${item.order.phone})`);
      window.open(url, '_blank');
    }, index * 300);
  });

  closeSMSPreviewModal();

  setTimeout(() => {
    alert(`✅ 已開啟 ${messages.length} 個簡訊視窗！`);
  }, 500);
};

// ==========================================
// ★★★ 6. 初始化完成 ★★★
// ==========================================

console.log('✅ sms.js 載入完成');
console.log('📦 已匯出函數:', {
  pushOrdersToSMS: typeof window.pushOrdersToSMS,
  receiveOrdersFromPay: typeof window.receiveOrdersFromPay,
  removeSMSOrder: typeof window.removeSMSOrder,
  editTemplate: typeof window.editTemplate,
  saveTemplate: typeof window.saveTemplate,
  deleteTemplate: typeof window.deleteTemplate,
  clearTemplateInput: typeof window.clearTemplateInput,
  previewTemplate: typeof window.previewTemplate,
  resetDefaultTemplates: typeof window.resetDefaultTemplates,
  deleteSmsOrder: typeof window.deleteSmsOrder,
  sendSelectedSMS: typeof window.sendSelectedSMS,
  closeSMSPreviewModal: typeof window.closeSMSPreviewModal,
  confirmSendSMS: typeof window.confirmSendSMS
});
