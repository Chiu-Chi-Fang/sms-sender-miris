// orders.js - 雲端同步版 (整合 Track.TW 物流追蹤 API)
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
const payOrdersRef = ref(db, 'pay_orders'); 

let payOrders = [];

// 1. 監聽雲端資料
onValue(payOrdersRef, (snapshot) => {
    const data = snapshot.val();
    payOrders = data || [];
    renderPayTable();
});

function savePayOrders() {
    set(payOrdersRef, payOrders).catch((err) => console.error('同步失敗', err));
}

// 2. 日期計算工具
function getNextWeekday(date, targetDay) {
    const d = new Date(date);
    const cur = d.getDay(); 
    let add = targetDay - cur;
    if (add <= 0) add += 7; 
    d.setDate(d.getDate() + add);
    return d;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function calculatePaymentDate(platform, pickupDateStr) {
    if (!pickupDateStr) return { settlement: '-', payment: '-' };
    const pickupDate = new Date(pickupDateStr);
    const dow = pickupDate.getDay(); 
    let settlementDate, paymentDate;

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

// ==========================================
// ★★★ 物流追蹤功能 (整合 API Token) ★★★
// ==========================================
window.checkAllTracking = async function() {
    const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx));
    if(indices.length === 0) return alert('請先勾選要查詢的訂單\n(建議先勾選一筆測試)');

    // 提醒使用者：內部單號 (#1493) 通常查不到，需要真正的物流單號 (如 860...)
    const confirmMsg = `準備查詢 ${indices.length} 筆訂單...\n\n⚠️ 注意：系統將使用「訂單號」作為「物流單號」去查詢。\n若您的訂單號是內部編號 (如 #1493)，API 可能會回傳查無資料。`;
    if(!confirm(confirmMsg)) return;

    for (let i of indices) {
        await checkTrackingSingle(i);
    }
    
    savePayOrders();
    alert('查詢完成！');
};

async function checkTrackingSingle(index) {
    const order = payOrders[index];
    if(!order.no) return;

    // ★ 簡單防呆：如果是 # 開頭的內部單號，可能查不到，這裡還是會試著查，但您可以自行決定是否要擋掉
    // if(order.no.startsWith('#')) { ... }

    order.trackingStatus = "⏳...";
    renderPayTable();

    try {
        // ★★★ API 設定區 ★★★
        // 1. 填入您截圖中的 Token
        const apiToken = "WSKyGuq6SjJJoC4VwD0d81D66n83rhnkxWqPY0te32f27c21";
        
        // 2. 設定 API 網址
        // ⚠️ 重要：這裡假設有一個可以用 `tracking_number` 查詢的端點。
        // 如果 Track.TW 規定一定要用 UUID，那這裡會失敗，需要先呼叫「新增包裹」API 拿到 UUID。
        // 我們先嘗試用 search 或 query 的方式：
        const apiUrl = `https://track.tw/api/v1/package/tracking-number/${encodeURIComponent(order.no)}`; 
        // 備註：如果上面網址 404，請試試看: `https://track.tw/api/v1/packages?tracking_number=${order.no}`

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}` // ★ 這裡加入了您的 Token
            }
        });

        if (!response.ok) {
            // 如果 API 回傳錯誤 (例如 404 找不到)，丟出錯誤
            throw new Error(`API ${response.status}`);
        }

        const data = await response.json();
        
        // ★★★ 解析回傳資料 ★★★
        let statusText = "無資料";

        if (data.package_history && data.package_history.length > 0) {
            const latest = data.package_history[0];
            statusText = latest.status || latest.checkpoint_status || "未知";
        } else if (data.status) {
            statusText = data.status;
        } else if (data.data && data.data.status) { // 有些 API 會包在 data 裡
             statusText = data.data.status;
        }
        
        order.trackingStatus = statusText;

        // ★★★ 自動填入取貨日 ★★★
        if (statusText.match(/已配達|已取|完成|delivered|arrived/)) {
            const today = new Date().toISOString().split('T')[0];
            if(!order.pickupDate) {
                order.pickupDate = today;
            }
        }

    } catch (error) {
        console.error(`訂單 ${order.no} 查詢失敗:`, error);
        order.trackingStatus = "❌ 失敗"; // 可能是單號錯誤或 API 網址不對
    }
    
    renderPayTable();
}


// 3. 渲染列表 (維持不變)
function renderPayTable() {
    const tbody = document.getElementById('payTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    const totalCount = payOrders.length;
    const pickedCount = payOrders.filter(o => o.pickupDate).length;
    const unpickedCount = totalCount - pickedCount;

    if(document.getElementById('cnt-all')) document.getElementById('cnt-all').innerText = `(${totalCount})`;
    if(document.getElementById('cnt-picked')) document.getElementById('cnt-picked').innerText = `(${pickedCount})`;
    if(document.getElementById('cnt-unpicked')) document.getElementById('cnt-unpicked').innerText = `(${unpickedCount})`;

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

        let trackColor = '#007bff'; 
        if(order.trackingStatus && (order.trackingStatus.includes('已') || order.trackingStatus.includes('完成'))) trackColor = '#28a745'; 
        if(order.trackingStatus && order.trackingStatus.includes('失敗')) trackColor = '#dc3545'; 

        const trackHtml = order.trackingStatus 
            ? `<span style="font-size:12px; color:${trackColor}; font-weight:bold;">${order.trackingStatus}</span>` 
            : '<span style="color:#ccc;">-</span>';

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
                    <button class="btn btn-danger btn-sm" style="pointer-events: none;">📦 未取貨</button>
                    <input type="date" class="hidden-date-input" 
                           onchange="updateOrderPickup(${index}, this.value)">
                </div>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="pay-chk" data-idx="${index}"></td>
            <td>${order.no}</td>
            <td>${order.name}</td>
            <td>${order.phone}</td>
            <td><span style="background:#eee; padding:2px 6px; border-radius:4px; font-size:12px">${order.platform}</span></td>
            <td>${order.shipDate || '-'}</td>
            <td>${order.deadline || '-'}</td>
            <td>${trackHtml}</td>
            <td>${statusHtml}</td>
            <td><button class="btn btn-secondary btn-sm" onclick="deleteOrder(${index})">❌</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// 4. 匯入功能 (維持不變)
window.importFromText = function() {
    const txt = document.getElementById('importText').value;
    if(!txt) return alert('請先貼上資料喔！');
    const lines = txt.split('\n');
    let count = 0;
    lines.forEach(line => {
        if(!line.trim()) return;
        const cols = line.trim().split(/[|\t,\s]+/).filter(Boolean);
        if(cols.length >= 3) {
            let rawPlatform = cols[3] || '';
            let finalPlatform = rawPlatform;
            if(rawPlatform.includes('賣貨便')) finalPlatform = '7-11';
            else if(rawPlatform.includes('好賣')) finalPlatform = '全家';

            payOrders.push({
                no: cols[0], name: cols[1], phone: cols[2], platform: finalPlatform,
                store: cols[4] || '', shipDate: cols[5] || '', deadline: cols[6] || '',
                pickupDate: null, trackingStatus: ''
            });
            count++;
        }
    });
    if(count > 0) {
        savePayOrders();
        alert(`成功匯入 ${count} 筆資料！`);
        document.getElementById('importText').value = '';
        if(window.switchPaySubTab) window.switchPaySubTab('orders');
    } else { alert('匯入失敗：格式不符'); }
};

// 全域綁定
window.addNewOrder = function() {
    const no = document.getElementById('addOrderNo').value;
    const name = document.getElementById('addName').value;
    if(!no || !name) return alert('請填寫完整資訊');
    let p = document.getElementById('addPlatform').value;
    if(p.includes('賣貨便')) p = '7-11';
    if(p.includes('好賣')) p = '全家';
    payOrders.push({
        no: no.startsWith('#') ? no : '#'+no, name: name, phone: document.getElementById('addPhone').value,
        platform: p, store: '', shipDate: document.getElementById('addShipDate').value,
        deadline: document.getElementById('addDeadline').value, pickupDate: null, trackingStatus: ''
    });
    savePayOrders(); alert('新增成功！');
};
window.updateOrderPickup = function(index, dateStr) {
    if(dateStr) { payOrders[index].pickupDate = dateStr; savePayOrders(); if(window.removeSMSOrder) window.removeSMSOrder(payOrders[index].no); }
};
window.resetOrderStatus = function(index) {
    if(confirm('重設為未取貨？')) { payOrders[index].pickupDate = null; savePayOrders(); }
};
window.deleteOrder = function(index) {
    if(confirm('確定刪除？')) { payOrders.splice(index, 1); savePayOrders(); }
};
window.toggleSelectAllPay = function() {
    const checked = document.getElementById('selectAllPay').checked;
    document.querySelectorAll('.pay-chk').forEach(c => c.checked = checked);
};
window.batchSetDate = function() {
    const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx));
    if(indices.length === 0) return alert('請先勾選訂單');
    const dateVal = document.getElementById('batchDateInput').value;
    if(!dateVal) return alert('請先選擇日期');
    if(confirm(`將選取的 ${indices.length} 筆訂單設為 ${dateVal} 取貨？`)) {
        indices.forEach(i => { payOrders[i].pickupDate = dateVal; if(window.removeSMSOrder) window.removeSMSOrder(payOrders[i].no); });
        savePayOrders();
    }
};
window.batchDeleteOrders = function() {
    const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx));
    if(indices.length === 0) return;
    if(confirm(`刪除 ${indices.length} 筆？`)) {
        indices.sort((a,b) => b-a).forEach(i => payOrders.splice(i, 1));
        savePayOrders();
        document.getElementById('selectAllPay').checked = false;
    }
};
window.pushToSMS = function() {
    const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx));
    if(indices.length === 0) return alert('請先勾選訂單');
    const dataToSync = indices.map(i => payOrders[i]);
    if(window.receiveOrdersFromPay) {
        window.receiveOrdersFromPay(dataToSync);
        alert(`已同步 ${indices.length} 筆訂單到 SMS 系統！`);
        switchMainTab('sms');
    } else { alert('SMS 模組尚未載入，請稍候'); }
};
window.doCalc = function() {
    const p = document.getElementById('calcPlatform').value;
    const d = document.getElementById('calcDate').value;
    if(!d) return;
    const res = calculatePaymentDate(p, d);
    document.getElementById('calcResult').innerText = `💰 預計撥款日：${res.payment}`;
};
window.renderPayTable = renderPayTable;
window.checkAllTracking = checkAllTracking;
