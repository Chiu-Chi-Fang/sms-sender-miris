// orders.js - 雲端同步版 (Batch V9: Proxy Header 修復版 + 批量匯入修復)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

console.log(`🚀 orders.js (Batch V9 - Proxy Header Fix) Loaded at ${new Date().toLocaleTimeString()}`);

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

onValue(payOrdersRef, (snapshot) => {
    const data = snapshot.val();
    payOrders = data || [];
    if(window.renderPayTable) window.renderPayTable();
});

function savePayOrders() {
    set(payOrdersRef, payOrders).catch((err) => console.error('同步失敗', err));
}

// ==========================================
// ★★★ 1. 批量匯入 (定義並綁定) ★★★
// ==========================================
function importFromTextImpl() {
    const el = document.getElementById('importText');
    if (!el) return alert('找不到輸入框 (ID: importText)，請確認在正確分頁');
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
    } else {
        alert('匯入失敗：格式不符');
    }
}

// ==========================================
// ★★★ 2. 追蹤貨況 (Header 修復版) ★★★
// ==========================================
async function checkAllTrackingImpl() {
    const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx));
    if(indices.length === 0) return alert('請先勾選要查詢的訂單');

    if(!confirm(`準備查詢 ${indices.length} 筆訂單...\n(請確認已點擊 cors-anywhere 開通按鈕)`)) return;

    indices.forEach(i => { payOrders[i].trackingStatus = "⏳ 查詢中..."; });
    if(window.renderPayTable) window.renderPayTable();

    const apiToken = "WSKyGuq6SjJJoC4VwD0d81D66n83rhnkxWqPY0te32f27c21";
    const proxyUrl = "https://cors-anywhere.herokuapp.com/";
    const targetUrl = "https://track.tw/api/v1";

    const chunkArray = (arr, size) => {
        const result = [];
        for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
        return result;
    };

    try {
        const groups = {};
        indices.forEach(idx => {
            const order = payOrders[idx];
            const trackNo = order.trackingNum || order.no;
            let carrierId = "";
            if (order.platform) {
                for(let key of Object.keys(carrierMap)) {
                    if(order.platform.includes(key)) { carrierId = carrierMap[key]; break; }
                }
            }
            if(carrierId && trackNo) {
                if(!groups[carrierId]) groups[carrierId] = [];
                groups[carrierId].push(trackNo);
            }
        });

        // 1. 批次匯入
        for (const [cId, numbers] of Object.entries(groups)) {
            const chunks = chunkArray(numbers, 40);
            for (const chunk of chunks) {
                console.log(`匯入 ${chunk.length} 筆...`);
                try {
                    const res = await fetch(`${proxyUrl}${targetUrl}/package/import`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json', 
                            'Authorization': `Bearer ${apiToken}`,
                            'X-Requested-With': 'XMLHttpRequest' // ★★★ 關鍵修復：加上這個 Header ★★★
                        },
                        body: JSON.stringify({
                            "carrier_id": cId,
                            "tracking_number": chunk,
                            "notify_state": "inactive"
                        })
                    });
                    
                    if (res.status === 403 || res.status === 429) {
                        const text = await res.text();
                        if (text.includes("See /corsdemo")) throw new Error("PROXY_NEED_AUTH");
                    }
                } catch(importErr) {
                    if(importErr.message === "PROXY_NEED_AUTH") throw importErr;
                    console.warn("匯入警告:", importErr);
                }
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        // 2. 下載狀態
        console.log("下載貨況...");
        const inboxRes = await fetch(`${proxyUrl}${targetUrl}/package/all/inbox?size=100`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${apiToken}`,
                'X-Requested-With': 'XMLHttpRequest' // ★★★ 關鍵修復：加上這個 Header ★★★
            }
        });

        if (inboxRes.status === 403) throw new Error("PROXY_NEED_AUTH");
        if (!inboxRes.ok) throw new Error(`API錯誤 ${inboxRes.status}`);
        
        const inboxData = await inboxRes.json();
        const packageList = inboxData.data || [];
        const statusMap = {};
        
        packageList.forEach(item => {
            if(item.package && item.package.tracking_number) {
                let rawStatus = item.package.latest_package_history; 
                if(!rawStatus && item.package.package_history && item.package.package_history.length > 0) {
                     rawStatus = item.package.package_history[0].status || item.package.package_history[0].checkpoint_status;
                }
                if(!rawStatus && item.state) rawStatus = item.state;
                if(rawStatus) statusMap[item.package.tracking_number] = rawStatus;
            }
        });

        // 3. 更新
        let updatedCount = 0;
        indices.forEach(idx => {
            const order = payOrders[idx];
            const trackNo = order.trackingNum || order.no;
            const rawStatus = statusMap[trackNo];

            if(rawStatus) {
                let showStatus = rawStatus;
                let s = String(rawStatus).toLowerCase(); 

                if (s.includes('delivered') || s.includes('finish') || s.includes('complete') || s.includes('success')) {
                    showStatus = "✅ 已配達";
                } else if (s.includes('picked') || s.includes('collected')) {
                    showStatus = "✅ 已取件";
                } else if (s.includes('store') || s.includes('arrival') || s.includes('arrived') || s.includes('ready') || s.includes('門市') || s.includes('已達')) {
                    showStatus = "🏪 已達門市";
                } else if (s.includes('transit') || s.includes('shipping') || s.includes('transport') || s.includes('way') || s.includes('配送')) {
                    showStatus = "🚚 配送中";
                } else if (s.includes('pending') || s.includes('created') || s.includes('order_placed')) {
                    showStatus = "📄 待出貨";
                } else if (s.includes('return')) {
                    showStatus = "🔙 退貨中";
                }

                order.trackingStatus = showStatus;
                updatedCount++;

                if (showStatus.includes("已配達") || showStatus.includes("已取") || showStatus.includes("已達")) {
                    if(!order.pickupDate) order.pickupDate = new Date().toISOString().split('T')[0];
                }
            } else {
                order.trackingStatus = "查無資料(可能單號錯誤)";
            }
        });

        savePayOrders();
        alert(`查詢完成！更新了 ${updatedCount} 筆訂單。`);

    } catch (e) {
        console.error("Tracking Error:", e);
        let msg = "連線失敗";
        if (e.message === "PROXY_NEED_AUTH" || e.message.includes("403")) {
            msg = "請點擊新視窗按鈕開通連線！";
            window.open("https://cors-anywhere.herokuapp.com/corsdemo", "_blank");
        }
        
        indices.forEach(i => { 
            if(payOrders[i].trackingStatus === "⏳ 查詢中...") 
                payOrders[i].trackingStatus = "❌ " + msg; 
        });
        savePayOrders();
        alert(msg);
    }
}

// ==========================================
// ★★★ 3. 渲染與工具 ★★★
// ==========================================
function calculatePaymentDate(platform, pickupDateStr) {
    if (!pickupDateStr) return { settlement: '-', payment: '-' };
    const pickupDate = new Date(pickupDateStr);
    const dow = pickupDate.getDay(); 
    let settlementDate, paymentDate;
    const addDays = (d, n) => { const date = new Date(d); date.setDate(date.getDate() + n); return date; };
    const getNextWeekday = (d, t) => { const date = new Date(d); const cur = date.getDay(); let add = t - cur; if (add <= 0) add += 7; date.setDate(date.getDate() + add); return date; };

    if (platform && (platform.includes('賣貨便') || platform.includes('7-11'))) {
        if (dow >= 1 && dow <= 3) { settlementDate = getNextWeekday(pickupDate, 4); paymentDate = addDays(settlementDate, 4); } 
        else { settlementDate = getNextWeekday(pickupDate, 1); paymentDate = addDays(settlementDate, 2); }
    } else {
        if (dow >= 1 && dow <= 3) { settlementDate = getNextWeekday(pickupDate, 5); paymentDate = addDays(settlementDate, 4); } 
        else { settlementDate = getNextWeekday(pickupDate, 3); paymentDate = addDays(settlementDate, 1); }
    }
    return { settlement: settlementDate.toISOString().split('T')[0], payment: paymentDate.toISOString().split('T')[0] };
}

function renderPayTableImpl() {
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
        
        let trackColor = '#6c757d'; 
        if (order.trackingStatus) {
            if (order.trackingStatus.includes('配達') || order.trackingStatus.includes('已取')) trackColor = '#28a745'; 
            else if (order.trackingStatus.includes('門市')) trackColor = '#17a2b8'; 
            else if (order.trackingStatus.includes('配送')) trackColor = '#007bff'; 
            else if (order.trackingStatus.includes('查無') || order.trackingStatus.includes('❌')) trackColor = '#dc3545'; 
            
            if (order.trackingStatus.includes('❌') || order.trackingStatus.includes('查無') || order.trackingStatus.includes('LINK') || order.trackingStatus.includes('連線')) {
                 let linkUrl = "#";
                 if (order.platform && order.platform.includes("7-11")) linkUrl = `https://eservice.7-11.com.tw/E-Tracking/search.aspx?shipNum=${queryNo}`;
                 else if (order.platform && order.platform.includes("全家")) linkUrl = `https://www.famiport.com.tw/Web_Famiport/page/process.aspx`;
                 
                 trackHtml = `<a href="${linkUrl}" target="_blank" style="color:${trackColor}; font-weight:bold; text-decoration:underline;">${order.trackingStatus}</a>`;
            } else {
                 trackHtml = `<span style="font-size:12px; color:${trackColor}; font-weight:bold;">${order.trackingStatus}</span>`;
            }
        }
        
        const subNoHtml = order.trackingNum ? `<br><span style="font-size:10px; color:#999;">🚚 ${order.trackingNum}</span>` : '';
        let statusHtml = '';
        if (order.pickupDate) {
            const calc = calculatePaymentDate(order.platform, order.pickupDate);
            statusHtml = `<div style="text-align:right"><button class="btn btn-success btn-sm" onclick="resetOrderStatus(${index})">✅ 已取 (${order.pickupDate.slice(5)})</button><div style="font-size:13px; color:#d63031; font-weight:bold; margin-top:4px;">💰 撥款: ${calc.payment}</div></div>`;
        } else {
            statusHtml = `<div class="action-wrapper"><button class="btn btn-danger btn-sm" style="pointer-events: none;">📦 未取貨</button><input type="date" class="hidden-date-input" onchange="updateOrderPickup(${index}, this.value)"></div>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input type="checkbox" class="pay-chk" data-idx="${index}"></td><td>${order.no}</td><td>${order.name}</td><td>${order.phone}</td><td><span style="background:#eee; padding:2px 6px; border-radius:4px; font-size:12px">${order.platform}</span></td><td>${order.shipDate || '-'}</td><td>${order.deadline || '-'}</td><td>${trackHtml} ${subNoHtml}</td><td>${statusHtml}</td><td><button class="btn btn-secondary btn-sm" onclick="deleteOrder(${index})">❌</button></td>`;
        tbody.appendChild(tr);
    });
}

// 綁定其他工具
function addNewOrderImpl() { const no = document.getElementById('addOrderNo').value; const name = document.getElementById('addName').value; if(!no || !name) return alert('請填寫完整資訊'); let p = document.getElementById('addPlatform').value; if(p.includes('賣貨便')) p = '7-11'; if(p.includes('好賣')) p = '全家'; payOrders.push({ no: no.startsWith('#') ? no : '#'+no, name: name, phone: document.getElementById('addPhone').value, platform: p, store: '', shipDate: document.getElementById('addShipDate').value, deadline: document.getElementById('addDeadline').value, pickupDate: null, trackingStatus: '', trackingNum: '' }); savePayOrders(); alert('新增成功！'); }
function updateOrderPickupImpl(index, dateStr) { if(dateStr) { payOrders[index].pickupDate = dateStr; savePayOrders(); if(window.removeSMSOrder) window.removeSMSOrder(payOrders[index].no); } }
function resetOrderStatusImpl(index) { if(confirm('重設為未取貨？')) { payOrders[index].pickupDate = null; savePayOrders(); } }
function deleteOrderImpl(index) { if(confirm('確定刪除？')) { payOrders.splice(index, 1); savePayOrders(); } }
function toggleSelectAllPayImpl() { const checked = document.getElementById('selectAllPay').checked; document.querySelectorAll('.pay-chk').forEach(c => c.checked = checked); }
function batchSetDateImpl() { const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx)); if(indices.length === 0) return alert('請先勾選訂單'); const dateVal = document.getElementById('batchDateInput').value; if(!dateVal) return alert('請先選擇日期'); if(confirm(`將選取的 ${indices.length} 筆訂單設為 ${dateVal} 取貨？`)) { indices.forEach(i => { payOrders[i].pickupDate = dateVal; if(window.removeSMSOrder) window.removeSMSOrder(payOrders[i].no); }); savePayOrders(); } }
function batchDeleteOrdersImpl() { const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx)); if(indices.length === 0) return; if(confirm(`刪除 ${indices.length} 筆？`)) { indices.sort((a,b) => b-a).forEach(i => payOrders.splice(i, 1)); savePayOrders(); document.getElementById('selectAllPay').checked = false; } }
function pushToSMSImpl() { const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx)); if(indices.length === 0) return alert('請先勾選訂單'); const dataToSync = indices.map(i => payOrders[i]); if(window.receiveOrdersFromPay) { window.receiveOrdersFromPay(dataToSync); alert(`已同步 ${indices.length} 筆訂單到 SMS 系統！`); switchMainTab('sms'); } else { alert('SMS 模組尚未載入，請稍候'); } }
function doCalcImpl() { const p = document.getElementById('calcPlatform').value; const d = document.getElementById('calcDate').value; if(!d) return; const res = calculatePaymentDate(p, d); document.getElementById('calcResult').innerText = `💰 預計撥款日：${res.payment}`; }
function exportOrdersExcelImpl() { if(!payOrders || payOrders.length === 0) return alert('目前沒有訂單可以匯出'); if(typeof XLSX !== 'undefined') { const ws = XLSX.utils.json_to_sheet(payOrders); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Orders"); XLSX.writeFile(wb, "orders_backup.xlsx"); } else { alert('匯出元件未載入'); } }

// 綁定所有功能到 window
window.importFromText = importFromTextImpl;
window.checkAllTracking = checkAllTrackingImpl;
window.renderPayTable = renderPayTableImpl;
window.addNewOrder = addNewOrderImpl;
window.updateOrderPickup = updateOrderPickupImpl;
window.resetOrderStatus = resetOrderStatusImpl;
window.deleteOrder = deleteOrderImpl;
window.toggleSelectAllPay = toggleSelectAllPayImpl;
window.batchSetDate = batchSetDateImpl;
window.batchDeleteOrders = batchDeleteOrdersImpl;
window.pushToSMS = pushToSMSImpl;
window.doCalc = doCalcImpl;
window.exportOrdersExcel = exportOrdersExcelImpl;

console.log("✅ orders.js 載入成功！");
```

### 📋 記得操作
1.  **強制重新整理 (Ctrl + F5)**。
2.  確認 Proxy 已開通。
3.  測試查詢。

這次加上了 `X-Requested-With` header，一定能順利通關！🚀
