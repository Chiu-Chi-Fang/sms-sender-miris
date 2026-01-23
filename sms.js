// sms.js - 修正版
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

console.log('🚀 sms.js 開始載入...');

// ★★★ 檢查 Firebase 是否已初始化 ★★★
let app;
if (getApps().length === 0) {
  // 如果還沒初始化,才執行初始化
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
  // 如果已經初始化,直接取用
  app = getApp();
  console.log('✅ 使用現有的 Firebase 實例 (sms.js)');
}

const db = getDatabase(app);

let smsOrders = [];
let templates = [];
let editingIndex = -1;

const defaultTemplates = [
    { name: "到貨通知", content: "{name} 您好，您訂購的商品 {no} 已抵達 {storeType} {storeName}，請於 {deadline} 前取貨，謝謝！" },
    { name: "催領通知(3天)", content: "{name} 您好，您的包裹 {no} 已到店 3 天，請盡快取貨以免退回。" },
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

window.receiveOrdersFromPay = function(orderList) {
    console.log('📥 收到訂單:', orderList);
    let count = 0;
    orderList.forEach(newOrd => {
        const exists = smsOrders.find(o => o.no === newOrd.no);
        if(!exists) {
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
    if(count > 0) {
        set(ordersRef, smsOrders);
        console.log(`✅ 新增 ${count} 筆 SMS 訂單`);
    } else {
        console.log('ℹ️ 沒有新訂單需要新增');
    }
};

window.removeSMSOrder = function(orderNo) {
    const initialLen = smsOrders.length;
    smsOrders = smsOrders.filter(o => o.no !== orderNo);
    if(smsOrders.length !== initialLen) {
        set(ordersRef, smsOrders);
        console.log(`🗑️ 已移除訂單: ${orderNo}`);
    }
};

// ==========================================
// ★★★ 3. 渲染 SMS 列表 ★★★
// ==========================================

function renderSmsList() {
    const container = document.getElementById('smsListContainer');
    if(!container) {
        console.warn('⚠️ 找不到 #smsListContainer');
        return;
    }
    
    if(smsOrders.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#ccc;">目前沒有待發送名單</div>';
        return;
    }

    container.innerHTML = smsOrders.map((o, idx) => {
        const platformText = o.platform || '平台未指定';
        const storeText = o.store || '門市未指定';
        
        return `
        <div class="sms-card">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong><input type="checkbox" class="sms-chk" value="${idx}"> ${o.name}</strong>
                <button class="btn btn-sm btn-secondary" onclick="deleteSmsOrder(${idx})">🗑️</button>
            </div>
            <div style="font-size:13px; color:#666;">
                ${o.phone} | ${o.no} <br>
                <span style="color:#2980b9; font-weight:bold;">${platformText}</span> ${storeText} 
                <span style="font-size:12px; color:#999;">(${o.deadline||'無期限'})</span>
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
    if(!container) {
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
    
    if(!name || !content) {
        alert('⚠️ 名稱和內容不能為空！');
        return;
    }
    
    if(editingIndex >= 0) {
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
    if(confirm('確定要刪除這個範本嗎？')) {
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
    if(!sel) {
        console.warn('⚠️ 找不到 #smsTemplateSelect');
        return;
    }
    
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">-- 請選擇範本 --</option>' + 
        templates.map((t, i) => `<option value="${i}">${t.name}</option>`).join('');
        
    if(currentVal && templates[currentVal]) {
        sel.value = currentVal;
    }
    
    console.log('✅ 範本選單已更新');
}

window.previewTemplate = function() {
    const idx = document.getElementById('smsTemplateSelect').value;
    if(idx === "") {
        document.getElementById('smsPreviewBox').value = '';
        return;
    }
    const tpl = templates[idx];
    document.getElementById('smsPreviewBox').value = tpl.content;
    console.log('👁️ 預覽範本:', tpl.name);
};

window.resetDefaultTemplates = function() {
    if(confirm('重置將恢復預設範本，您自訂的範本會消失，確定嗎？')) {
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
// ★★★ 5. 發送 SMS ★★★
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
    if(chks.length === 0) {
        alert('⚠️ 請先勾選名單');
        return;
    }
    
    const rawContent = document.getElementById('smsPreviewBox').value;
    if(!rawContent) {
        alert('⚠️ 內容不能為空，請先選擇範本');
        return;
    }
    
    console.log(`📤 準備發送 ${chks.length} 則簡訊`);
    
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
            .replace(/{storeType}/g, order.platform || '');
            
        const url = `sms:${order.phone}?body=${encodeURIComponent(finalMsg)}`;
        console.log(`📱 發送給 ${order.name} (${order.phone})`);
        window.open(url, '_blank');
    });
    
    alert(`✅ 已開啟 ${chks.length} 個簡訊視窗`);
};

// ==========================================
// ★★★ 6. 初始化完成 ★★★
// ==========================================

console.log('✅ sms.js 載入完成');
console.log('📦 已匯出函數:', {
    receiveOrdersFromPay: typeof window.receiveOrdersFromPay,
    removeSMSOrder: typeof window.removeSMSOrder,
    editTemplate: typeof window.editTemplate,
    saveTemplate: typeof window.saveTemplate,
    deleteTemplate: typeof window.deleteTemplate,
    sendSelectedSMS: typeof window.sendSelectedSMS
});
