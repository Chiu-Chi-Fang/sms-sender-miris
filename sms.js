// sms.js - 最終版 (含範本新增、修改、刪除功能)
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
let editingIndex = -1; // 用來記錄現在正在編輯哪一個範本 (-1 代表新增模式)

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

// 2. 接收訂單 (含門市與平台)
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
    if(count > 0) set(ordersRef, smsOrders);
};

window.removeSMSOrder = function(orderNo) {
    const initialLen = smsOrders.length;
    smsOrders = smsOrders.filter(o => o.no !== orderNo);
    if(smsOrders.length !== initialLen) set(ordersRef, smsOrders);
};

// 3. 渲染 SMS 列表
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

// ==========================================
// ★★★ 4. 範本管理 (新增/修改/刪除) ★★★
// ==========================================

// 渲染範本列表 (加上編輯與刪除按鈕)
function renderTemplates() {
    const container = document.getElementById('templateListContainer');
    if(!container) return;
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
}

// 點擊「編輯」：把資料帶入上方輸入框
window.editTemplate = function(idx) {
    editingIndex = idx;
    const t = templates[idx];
    document.getElementById('tplNameInput').value = t.name;
    document.getElementById('tplContentInput').value = t.content;
    document.getElementById('tplNameInput').focus();
    // 讓按鈕文字變更，提示使用者現在是修改模式
    document.querySelector('#sms-sub-tpl .btn-primary').innerText = "💾 更新範本";
};

// 點擊「儲存」：新增或更新
window.saveTemplate = function() {
    const name = document.getElementById('tplNameInput').value;
    const content = document.getElementById('tplContentInput').value;
    
    if(!name || !content) return alert('名稱和內容不能為空！');
    
    if(editingIndex >= 0) {
        // 更新現有
        templates[editingIndex] = { name, content };
        alert('範本已更新！');
    } else {
        // 新增
        templates.push({ name, content });
        alert('新範本已建立！');
    }
    
    // 存入 Firebase
    set(tplRef, templates);
    
    // 清空輸入框
    window.clearTemplateInput();
};

// 點擊「刪除」
window.deleteTemplate = function(idx) {
    if(confirm('確定要刪除這個範本嗎？')) {
        templates.splice(idx, 1);
        set(tplRef, templates);
    }
};

// 清空 / 取消編輯
window.clearTemplateInput = function() {
    editingIndex = -1;
    document.getElementById('tplNameInput').value = '';
    document.getElementById('tplContentInput').value = '';
    document.querySelector('#sms-sub-tpl .btn-primary').innerText = "💾 儲存範本";
};

// 更新下拉選單
function updateTemplateSelect() {
    const sel = document.getElementById('smsTemplateSelect');
    if(!sel) return;
    
    // 記住使用者當前選的是哪個，更新後試著選回來
    const currentVal = sel.value;
    
    sel.innerHTML = '<option value="">-- 請選擇範本 --</option>' + 
        templates.map((t, i) => `<option value="${i}">${t.name}</option>`).join('');
        
    if(currentVal && templates[currentVal]) {
        sel.value = currentVal;
    }
}

// 預覽與重置
window.previewTemplate = function() {
    const idx = document.getElementById('smsTemplateSelect').value;
    if(idx === "") return;
    const tpl = templates[idx];
    document.getElementById('smsPreviewBox').value = tpl.content;
};

window.resetDefaultTemplates = function() {
    if(confirm('重置將恢復預設範本，您自訂的範本會消失，確定嗎？')) {
        set(tplRef, defaultTemplates);
        alert('已重置！');
    }
};

window.deleteSmsOrder = function(idx) {
    smsOrders.splice(idx, 1);
    set(ordersRef, smsOrders);
};

// 6. 發送功能 (含日期瘦身工具)
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
    if(chks.length === 0) return alert('請先勾選名單');
    
    const rawContent = document.getElementById('smsPreviewBox').value;
    if(!rawContent) return alert('內容不能為空');
    
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
        window.open(url, '_blank');
    });
};
