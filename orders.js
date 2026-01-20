// orders.js - 雲端同步版 (高速直通版：強制清除快取 + Proxy + 直接取得 UUID)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// 加上時間戳記，確認載入的是最新版
console.log(`🚀 orders.js (Proxy + Direct UUID) Loaded at ${new Date().toLocaleTimeString()}`);

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

// 1. 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const payOrdersRef = ref(db, 'pay_orders'); 

// 2. 全域變數
let payOrders = [];

// 3. 物流商 ID 對照表
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

// 4. 監聽雲端資料
onValue(payOrdersRef, (snapshot) => {
    const data = snapshot.val();
    payOrders = data || [];
    renderPayTable();
});

// ==========================================
// 核心功能函式
// ==========================================

function savePayOrders() {
    set(payOrdersRef, payOrders).catch((err) => console.error('同步失敗', err));
}

function calculatePaymentDate(platform, pickupDateStr) {
    if (!pickupDateStr) return { settlement: '-', payment: '-' };
    const pickupDate = new Date(pickupDateStr);
    const dow = pickupDate.getDay(); 
    let settlementDate, paymentDate;

    // 簡單日期加法
    const addDays = (d, n) => { const date = new Date(d); date.setDate(date.getDate() + n); return date; };
    const getNextWeekday = (d, t) => { 
        const date = new Date(d); const cur = date.getDay(); 
        let add = t - cur; if (add <= 0) add += 7; 
        date.setDate(date.getDate() + add); return date; 
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

// --- 批量匯入功能 ---
function importFromTextImpl() {
    const el = document.getElementById('importText');
    if (!el) return;
    const txt = el.value;
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

            let trackNo = cols[7] || '';

            payOrders.push({
                no: cols[0], name: cols[1], phone: cols[2], platform: finalPlatform,
                store: cols[4] || '', shipDate: cols[5] || '', deadline: cols[6] || '',
                trackingNum: trackNo, pickupDate: null, trackingStatus: ''
            });
            count++;
        }
    });

    if(count > 0) {
        savePayOrders();
        alert(`成功匯入 ${count} 筆資料！`);
        el.value = '';
        if(window.switchPaySubTab) window.switchPaySubTab('orders');
    }
}

// --- 智慧追蹤功能 (Proxy + Direct UUID) ---
async function checkAllTrackingImpl() {
    const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx));
    if(indices.length === 0) return alert('請先勾選要查詢的訂單');

    if(!confirm(`準備查詢 ${indices.length} 筆訂單...\n(請確認已點擊 cors-anywhere 開通按鈕)`)) return;

    for (let i of indices) {
        await checkTrackingSingle(i);
        // 稍微暫停一下
        await new Promise(r => setTimeout(r, 500)); 
    }
    
    savePayOrders();
    alert('查詢完成！');
}

async function checkTrackingSingle(index) {
    const order = payOrders[index];
    const queryNo = order.trackingNum || order.no; 

    if(!queryNo) return;

    order.trackingStatus = "⏳ 查詢中...";
    renderPayTable();

    let carrierId = "";
    if (order.platform) {
        const keys = Object.keys(carrierMap);
        for(let key of keys) {
            if(order.platform.includes(key)) {
                carrierId = carrierMap[key];
                break;
            }
        }
    }

    if (!carrierId) {
        order.trackingStatus = "未知物流商";
        renderPayTable();
        return;
    }

    const apiToken = "WSKyGuq6SjJJoC4VwD0d81D66n83rhnkxWqPY0te32f27c21";
    // ★★★ Proxy 網址 (必須有這個才能繞過 CORS) ★★★
    const proxyUrl = "https://cors-anywhere.herokuapp.com/";
    const targetUrl = "https://track.tw/api/v1"; 
    
    let finalStatus = null;
    let errorMsg = "";

    try {
        // Step 1: 匯入 (Import) - API 會直接回傳 UUID 對照表
        // 範例回傳: { "M57607820155": "uuid-string-..." }
        console.log(`[${queryNo}] Step 1: 匯入並取得 UUID...`);
        
        const importRes = await fetch(`${proxyUrl}${targetUrl}/package/import`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${apiToken}`
            },
            body: JSON.stringify({
                "carrier_id": carrierId,
                "tracking_number": [queryNo], // 陣列
                "notify_state": "inactive"
            })
        });

        // 檢查 Proxy 是否需要開通
        if (importRes.status === 403) throw new Error("請點開通網址");
        
        const importData = await importRes.json();
        
        // ★★★ 直接從匯入結果拿 UUID (這是最快的方法) ★★★
        // 根據 API 文件，importData 是一個物件，key 是單號，value 是 UUID
        let targetUuid = importData[queryNo];

        if (!targetUuid) {
            // 如果沒抓到，可能是格式問題，嘗試把 key 轉大寫看看
            targetUuid = importData[queryNo.toUpperCase()];
        }

        if (!targetUuid) throw new Error("查無此單(匯入無回傳)");

        // Step 2: 用 UUID 查狀態
        console.log(`[${queryNo}] Step 2: 取得狀態 (UUID: ${targetUuid.slice(0,5)}...)...`);
        const trackRes = await fetch(`${proxyUrl}${targetUrl}/package/tracking/${targetUuid}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiToken}` }
        });

        const trackData = await trackRes.json();
        
        let statusText = "未知";
        if (trackData.package_history && trackData.package_history.length > 0) {
            const latest = trackData.package_history[0];
            statusText = latest.status || latest.checkpoint_status || "未知";
        }

        // 狀態翻譯
        if (statusText === "delivered") statusText = "已配達";
        if (statusText === "transit") statusText = "配送中";
        if (statusText === "pending") statusText = "待出貨";
        if (statusText === "picked_up") statusText = "已取件";
        if (statusText === "shipping") statusText = "運送中";
        if (statusText === "arrived") statusText = "已配達";

        finalStatus = statusText;

        if (statusText.match(/已配達|已取|完成|delivered|arrived/)) {
            if(!order.pickupDate) {
                const today = new Date().toISOString().split('T')[0];
                order.pickupDate = today;
            }
        }

    } catch (error) {
        console.error(`單號 ${queryNo} 錯誤:`, error);
        if (error.message.includes("開通") || error.message.includes("403")) {
            errorMsg = "請開通連線";
            window.open("https://cors-anywhere.herokuapp.com/corsdemo", "_blank");
        } else {
            errorMsg = error.message;
        }
    }

    if (finalStatus) {
        order.trackingStatus = finalStatus;
    } else {
        order.trackingStatus = "LINK_FALLBACK";
        order.debugMsg = errorMsg; 
    }
    
    renderPayTable();
}

// --- 渲染表格 ---
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
            }

            trackHtml = `
                <a href="${linkUrl}" target="_blank" class="btn btn-sm" style="background:${btnColor}; color:white; font-size:12px; padding:2px 8px; text-decoration:none;">${linkText}</a>
                ${order.debugMsg ? `<div style="font-size:9px; color:red; margin-top:2px;">${order.debugMsg}</div>` : ''}
            `;
            
        } else if (order.trackingStatus && order.trackingStatus !== "⏳ 查詢中...") {
            let trackColor = '#007bff'; 
            if(order.trackingStatus.match(/已配達|已取|完成|delivered/)) trackColor = '#28a745'; 
            
            trackHtml = `<span style="font-size:12px; color:${trackColor}; font-weight:bold;">${order.trackingStatus}</span>`;
        } else if (order.trackingStatus === "⏳ 查詢中...") {
            trackHtml = `<span style="font-size:12px; color:#f39c12;">⏳ 查詢中...</span>`;
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

// ==========================================
// ★★★ 最後一步：將功能綁定到 Window ★★★
// ==========================================
window.importFromText = importFromTextImpl;
window.renderPayTable = renderPayTable;
window.checkAllTracking = checkAllTrackingImpl;
// ... (其他小工具直接綁定，不另外寫Impl以節省篇幅) ...
window.addNewOrder = function() { const no = document.getElementById('addOrderNo').value; const name = document.getElementById('addName').value; if(!no || !name) return alert('請填寫完整資訊'); let p = document.getElementById('addPlatform').value; if(p.includes('賣貨便')) p = '7-11'; if(p.includes('好賣')) p = '全家'; payOrders.push({ no: no.startsWith('#') ? no : '#'+no, name: name, phone: document.getElementById('addPhone').value, platform: p, store: '', shipDate: document.getElementById('addShipDate').value, deadline: document.getElementById('addDeadline').value, pickupDate: null, trackingStatus: '', trackingNum: '' }); savePayOrders(); alert('新增成功！'); };
window.updateOrderPickup = function(index, dateStr) { if(dateStr) { payOrders[index].pickupDate = dateStr; savePayOrders(); if(window.removeSMSOrder) window.removeSMSOrder(payOrders[index].no); } };
window.resetOrderStatus = function(index) { if(confirm('重設為未取貨？')) { payOrders[index].pickupDate = null; savePayOrders(); } };
window.deleteOrder = function(index) { if(confirm('確定刪除？')) { payOrders.splice(index, 1); savePayOrders(); } };
window.toggleSelectAllPay = function() { const checked = document.getElementById('selectAllPay').checked; document.querySelectorAll('.pay-chk').forEach(c => c.checked = checked); };
window.batchSetDate = function() { const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx)); if(indices.length === 0) return alert('請先勾選訂單'); const dateVal = document.getElementById('batchDateInput').value; if(!dateVal) return alert('請先選擇日期'); if(confirm(`將選取的 ${indices.length} 筆訂單設為 ${dateVal} 取貨？`)) { indices.forEach(i => { payOrders[i].pickupDate = dateVal; if(window.removeSMSOrder) window.removeSMSOrder(payOrders[i].no); }); savePayOrders(); } };
window.batchDeleteOrders = function() { const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx)); if(indices.length === 0) return; if(confirm(`刪除 ${indices.length} 筆？`)) { indices.sort((a,b) => b-a).forEach(i => payOrders.splice(i, 1)); savePayOrders(); document.getElementById('selectAllPay').checked = false; } };
window.pushToSMS = function() { const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx)); if(indices.length === 0) return alert('請先勾選訂單'); const dataToSync = indices.map(i => payOrders[i]); if(window.receiveOrdersFromPay) { window.receiveOrdersFromPay(dataToSync); alert(`已同步 ${indices.length} 筆訂單到 SMS 系統！`); switchMainTab('sms'); } else { alert('SMS 模組尚未載入，請稍候'); } };
window.doCalc = function() { const p = document.getElementById('calcPlatform').value; const d = document.getElementById('calcDate').value; if(!d) return; const res = calculatePaymentDate(p, d); document.getElementById('calcResult').innerText = `💰 預計撥款日：${res.payment}`; };
window.exportOrdersExcel = function() { if(!payOrders || payOrders.length === 0) return alert('目前沒有訂單可以匯出'); if(typeof XLSX !== 'undefined') { const ws = XLSX.utils.json_to_sheet(payOrders); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Orders"); XLSX.writeFile(wb, "orders_backup.xlsx"); } else { alert('匯出元件未載入'); } };

console.log("✅ orders.js 載入成功！按鈕功能已就緒。");
