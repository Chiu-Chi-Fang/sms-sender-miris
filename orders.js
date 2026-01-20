// orders.js - 雲端同步版 (整合 Track.TW 物流商 ID 對照)
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

// ==========================================
// ★★★ 1. 物流商 ID 對照表 (根據您提供的 JSON) ★★★
// ==========================================
const carrierMap = {
    // 超商類
    '7-11': '9a980809-8865-4741-9f0a-3daaaa7d9e19',
    '賣貨便': '9a980809-8865-4741-9f0a-3daaaa7d9e19', // 賣貨便 = 7-11
    '全家': '9a980968-0ecf-4ee5-8765-fbeaed8a524e',
    '好賣+': '9a980968-0ecf-4ee5-8765-fbeaed8a524e', // 好賣+ = 全家
    '萊爾富': '9a980b3f-450f-4564-b73e-2ebd867666b0',
    'OK': '9a980d97-1101-4adb-87eb-78266878b384',
    'OK mart': '9a980d97-1101-4adb-87eb-78266878b384',
    '蝦皮': '9a98100c-c984-463d-82a6-ae86ec4e0b8a',
    '蝦皮店到店': '9a98100c-c984-463d-82a6-ae86ec4e0b8a',

    // 宅配類
    '郵局': '9a9812d2-c275-4726-9bdc-2ae5b4c42c73',
    '中華郵政': '9a9812d2-c275-4726-9bdc-2ae5b4c42c73',
    '黑貓': '9a98160d-27e3-40ab-9357-9d81466614e0',
    '黑貓宅急便': '9a98160d-27e3-40ab-9357-9d81466614e0',
    '宅配通': '9a984351-dc4f-405b-971c-671220c75f21',
    '新竹物流': '9a9840bc-a5d9-4c4a-8cd2-a79031b4ad53',
    '嘉里大榮': '9a98424a-935f-4b23-9a94-a08e1db52944',
    '順豐': '9b39c083-c77d-45a9-b403-2112bcddb1ae'
};

// 監聽雲端資料
onValue(payOrdersRef, (snapshot) => {
    const data = snapshot.val();
    payOrders = data || [];
    renderPayTable();
});

function savePayOrders() {
    set(payOrdersRef, payOrders).catch((err) => console.error('同步失敗', err));
}

// 日期計算工具
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
// ★★★ 2. 升級版物流追蹤 (自動帶入 Carrier ID) ★★★
// ==========================================
window.checkAllTracking = async function() {
    const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx));
    if(indices.length === 0) return alert('請先勾選要查詢的訂單');

    if(!confirm(`準備查詢 ${indices.length} 筆訂單...\n將使用對照表自動匹配物流商 ID。`)) return;

    for (let i of indices) {
        await checkTrackingSingle(i);
    }
    
    savePayOrders();
    alert('查詢完成！');
};

async function checkTrackingSingle(index) {
    const order = payOrders[index];
    const queryNo = order.trackingNum || order.no; 

    if(!queryNo) return;

    order.trackingStatus = "⏳...";
    renderPayTable();

    try {
        const apiToken = "WSKyGuq6SjJJoC4VwD0d81D66n83rhnkxWqPY0te32f27c21";
        
        // ★ 核心邏輯：根據平台名稱，找出對應的 Carrier ID
        let carrierId = "";
        if (order.platform) {
            // 嘗試模糊比對，例如 "7-11深澳坑" 也能抓到 "7-11"
            const keys = Object.keys(carrierMap);
            for(let key of keys) {
                if(order.platform.includes(key)) {
                    carrierId = carrierMap[key];
                    break;
                }
            }
        }

        // ★ 組裝網址：如果找到了 ID，就加在後面
        let apiUrl = `https://track.tw/api/v1/package/tracking-number/${encodeURIComponent(queryNo)}`;
        if (carrierId) {
            apiUrl += `?carrier_id=${carrierId}`;
        }

        console.log(`查詢: ${queryNo}, 平台: ${order.platform}, CarrierID: ${carrierId || '無'}`);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`
            }
        });

        if (!response.ok) throw new Error(`API ${response.status}`);

        const data = await response.json();
        
        let statusText = "無資料";
        if (data.package_history && data.package_history.length > 0) {
            const latest = data.package_history[0];
            statusText = latest.status || latest.checkpoint_status || "未知";
        } else if (data.data && data.data.status) {
             statusText = data.data.status;
        }
        
        order.trackingStatus = statusText;

        // 自動填入取貨日
        if (statusText.match(/已配達|已取|完成|delivered|arrived/)) {
            const today = new Date().toISOString().split('T')[0];
            if(!order.pickupDate) order.pickupDate = today;
        }

    } catch (error) {
        console.error(`單號 ${queryNo} 查詢失敗:`, error);
        order.trackingStatus = "LINK_FALLBACK"; // 失敗就轉為官方連結按鈕
    }
    
    renderPayTable();
}


// 3. 渲染列表
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

        const queryNo = order.trackingNum || order.no;

        // ★★★ 物流狀態顯示邏輯 ★★★
        let trackHtml = '<span style="color:#ccc;">-</span>';
        
        if (order.trackingStatus === "LINK_FALLBACK") {
            let linkUrl = "#";
            let linkText = "🔍 查官網";
            let btnColor = "#6c757d"; 

            if (order.platform && (order.platform.includes("7-11") || order.platform.includes("賣貨便"))) {
                linkUrl = `https://eservice.7-11.com.tw/E-Tracking/search.aspx?shipNum=${queryNo}`;
                linkText = "查 7-11";
                btnColor = "#27ae60"; 
            } else if (order.platform && (order.platform.includes("全家") || order.platform.includes("好賣"))) {
                linkUrl = `https://www.famiport.com.tw/Web_Famiport/page/process.aspx`; 
                linkText = "查 全家";
                btnColor = "#2980b9"; 
            } else if (order.platform && (order.platform.includes("萊爾富"))) {
                linkUrl = `https://www.hilife.com.tw/serviceInfo_search.aspx`;
                linkText = "查 萊爾富";
                btnColor = "#e74c3c";
            }

            trackHtml = `<a href="${linkUrl}" target="_blank" class="btn btn-sm" style="background:${btnColor}; color:white; font-size:12px; padding:2px 8px; text-decoration:none;">${linkText}</a>`;
            
        } else if (order.trackingStatus) {
            let trackColor = '#007bff'; 
            if(order.trackingStatus.includes('已') || order.trackingStatus.includes('完成')) trackColor = '#28a745'; 
            if(order.trackingStatus.includes('失敗')) trackColor = '#dc3545';
            
            trackHtml = `<span style="font-size:12px; color:${trackColor}; font-weight:bold;">${order.trackingStatus}</span>`;
        }

        const subNoHtml = order.trackingNum 
            ? `<br><span style="font-size:10px; color:#999;">🚚 ${order.trackingNum}</span>` 
            : '';

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
            <td>${trackHtml} ${subNoHtml}</td> 
            <td>${statusHtml}</td>
            <td><button class="btn btn-secondary btn-sm" onclick="deleteOrder(${index})">❌</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// 4. 匯入功能
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
                trackingNum: cols[7] || '', pickupDate: null, trackingStatus: ''
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

// ... 其他功能保持不變 ...
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
        deadline: document.getElementById('addDeadline').value, pickupDate: null, trackingStatus: '', trackingNum: ''
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
window.importFromText = importFromText;
