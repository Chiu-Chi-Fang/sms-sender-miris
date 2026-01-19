// sms.js - 最終版 (支援短日期 01/23 以節省簡訊費)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

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

let smsOrders = [];
let templates = [];

const defaultTemplates = [
    { name: "到貨通知", content: "{name} 您好，您訂購的商品 {no} 已抵達 {storeType} {storeName}，請於 {deadline} 前取貨，謝謝！" },
    { name: "催領通知(3天)", content: "{name} 您好，您的包裹 {no} 已到店 3 天，請盡快取貨以免退回。" },
];

const ordersRef = ref(db, 'sms_orders');
const tplRef = ref(db, 'templates');

// 1. 監聽 Firebase 資料
onValue(ordersRef, (snapshot) => {
    const data = snapshot.val();
    smsOrders = data || [];
    renderSmsList();
});

onValue(tplRef, (snapshot) => {
    const data = snapshot.val();
    templates = data || defaultTemplates;
    renderTemplates();
    updateTemplateSelect();
});

// 2. 接收來自 Pay 模組的資料
window.receiveOrdersFromPay = function(orderList) {
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
    }
};

// 3. 接收刪除指令
window.removeSMSOrder = function(orderNo) {
    const initialLen = smsOrders.length;
    smsOrders = smsOrders.filter(o => o.no !== orderNo);
    if(smsOrders.length !== initialLen) {
        set(ordersRef, smsOrders);
    }
};

// 4. 渲染 SMS 列表 (修正 undefined 問題)
function renderSmsList() {
    const container = document.getElementById('smsListContainer');
    if(!container) return;
    
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
}

// 5. 範本邏輯
function renderTemplates() {
    const container = document.getElementById('templateListContainer');
    if(!container) return;
    container.innerHTML = templates.map((t, i) => `
        <div style="border-bottom:1px solid #eee; padding:10px;">
            <strong>${t.name}</strong>
            <p style="font-size:12px; color:#666; margin:5px 0;">${t.content}</p>
        </div>
    `).join('');
}

function updateTemplateSelect() {
    const sel = document.getElementById('smsTemplateSelect');
    if(!sel) return;
    sel.innerHTML = '<option value="">-- 請選擇範本 --</option>' + 
        templates.map((t, i) => `<option value="${i}">${t.name}</option>`).join('');
}

window.previewTemplate = function() {
    const idx = document.getElementById('smsTemplateSelect').value;
    if(idx === "") return;
    const tpl = templates[idx];
    document.getElementById('smsPreviewBox').value = tpl.content;
};

window.resetDefaultTemplates = function() {
    if(confirm('重置將恢復預設範本，確定嗎？')) {
        set(tplRef, defaultTemplates);
        alert('已重置！');
    }
};

window.deleteSmsOrder = function(idx) {
    smsOrders.splice(idx, 1);
    set(ordersRef, smsOrders);
};

// ==========================================
// ★★★ 小工具：把長日期變成短日期 (MM/DD) ★★★
// ==========================================
function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    // 如果日期格式不對，就回傳原本的字串，避免錯誤
    if (isNaN(date.getTime())) return dateStr; 
    
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${m}/${d}`; // 這裡決定格式，例如 01/23
}

// 6. 發送功能 (已整合短日期)
window.sendSelectedSMS = function() {
    const chks = document.querySelectorAll('.sms-chk:checked');
    if(chks.length === 0) return alert('請先勾選名單');
    
    const rawContent = document.getElementById('smsPreviewBox').value;
    if(!rawContent) return alert('內容不能為空');
    
    chks.forEach(chk => {
        const idx = parseInt(chk.value);
        const order = smsOrders[idx];
        
        // ★ 取得短日期 ★
        const shortDeadline = formatShortDate(order.deadline);

        // 參數替換
        let finalMsg = rawContent
            // 姓名
            .replace(/{name}/g, order.name || '')
            .replace(/{customerName}/g, order.name || '')
            // 單號
            .replace(/{no}/g, order.no || '')
            .replace(/{orderNumber}/g, order.no || '')
            // ★★★ 期限 (現在會換成 01/23 這種短格式) ★★★
            .replace(/{deadline}/g, shortDeadline)
            .replace(/{pickupDeadline}/g, shortDeadline)
            // 門市
            .replace(/{storeName}/g, order.store || '')
            .replace(/{store}/g, order.store || '')
            // 平台
            .replace(/{storeType}/g, order.platform || '');
            
        const url = `sms:${order.phone}?body=${encodeURIComponent(finalMsg)}`;
        window.open(url, '_blank');
    });
};
