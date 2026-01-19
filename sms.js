// sms.js - 處理 Firebase 與簡訊邏輯
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Firebase 設定 (請確認這是您的 Config)
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

// 本地資料快取
let smsOrders = [];
let templates = [];

// 預設範本 (避免消失)
const defaultTemplates = [
    { name: "到貨通知", content: "{name} 您好，您訂購的商品 {no} 已抵達門市，請於 {deadline} 前取貨，謝謝！" },
    { name: "催領通知(3天)", content: "{name} 您好，您的包裹 {no} 已到店 3 天，請盡快取貨以免退回。" },
    { name: "最後通知", content: "【最後通知】{name} 您好，包裹 {no} 即將退回，請務必於今日取貨！" }
];

// 1. 監聽 Firebase 資料
const ordersRef = ref(db, 'sms_orders');
const tplRef = ref(db, 'templates');

onValue(ordersRef, (snapshot) => {
    const data = snapshot.val();
    smsOrders = data || [];
    renderSmsList();
});

onValue(tplRef, (snapshot) => {
    const data = snapshot.val();
    if(data) {
        templates = data;
    } else {
        // 如果雲端沒資料，載入預設值
        templates = defaultTemplates;
    }
    renderTemplates();
    updateTemplateSelect();
});

// 2. 接收來自 Pay 模組的資料
window.receiveOrdersFromPay = function(orderList) {
    // 簡單去重：檢查訂單號是否已存在
    let count = 0;
    orderList.forEach(newOrd => {
        const exists = smsOrders.find(o => o.no === newOrd.no);
        if(!exists) {
            smsOrders.push({
                no: newOrd.no,
                name: newOrd.name,
                phone: newOrd.phone,
                deadline: newOrd.deadline,
                addedAt: new Date().toISOString()
            });
            count++;
        }
    });
    // 同步回 Firebase
    if(count > 0) {
        set(ordersRef, smsOrders);
    }
};

// 3. 接收 Pay 模組的刪除指令 (已取貨 -> 刪除 SMS)
window.removeSMSOrder = function(orderNo) {
    const initialLen = smsOrders.length;
    smsOrders = smsOrders.filter(o => o.no !== orderNo);
    if(smsOrders.length !== initialLen) {
        set(ordersRef, smsOrders);
        console.log(`SMS 系統已同步移除訂單: ${orderNo}`);
    }
};

// 4. 渲染 SMS 列表
function renderSmsList() {
    const container = document.getElementById('smsListContainer');
    if(!container) return;
    
    if(smsOrders.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#ccc;">目前沒有待發送名單</div>';
        return;
    }

    container.innerHTML = smsOrders.map((o, idx) => `
        <div class="sms-card">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong><input type="checkbox" class="sms-chk" value="${idx}"> ${o.name}</strong>
                <button class="btn btn-sm btn-secondary" onclick="deleteSmsOrder(${idx})">🗑️</button>
            </div>
            <div style="font-size:13px; color:#666;">
                ${o.phone} | ${o.no} | 期限: ${o.deadline||'未定'}
            </div>
        </div>
    `).join('');
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

// 6. 發送功能 (開啟手機簡訊)
window.sendSelectedSMS = function() {
    const chks = document.querySelectorAll('.sms-chk:checked');
    if(chks.length === 0) return alert('請先勾選名單');
    
    const rawContent = document.getElementById('smsPreviewBox').value;
    if(!rawContent) return alert('內容不能為空');
    
    // 針對每一個勾選的人發送
    chks.forEach(chk => {
        const idx = parseInt(chk.value);
        const order = smsOrders[idx];
        
        // 替換變數
        let finalMsg = rawContent
            .replace(/{name}/g, order.name)
            .replace(/{no}/g, order.no)
            .replace(/{deadline}/g, order.deadline||'');
            
        // 呼叫 SMS 連結
        // 注意：瀏覽器可能會擋多重彈窗，建議一次發送少量
        const url = `sms:${order.phone}?body=${encodeURIComponent(finalMsg)}`;
        window.open(url, '_blank');
    });
};
