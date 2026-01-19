// orders.js - 雲端同步版 (請填入您的 sms-miris 設定)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// ★★★ 請將這裡換成您 sms-miris 的設定 (跟 sms.js 一模一樣) ★★★
const firebaseConfig = {
  apiKey: "AIzaSyDcKclyNssDs08E0DIwfrc7lzq3QQL4QS8",
  authDomain: "sms-miris.firebaseapp.com",
  databaseURL: "https://sms-miris-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sms-miris",
  storageBucket: "sms-miris.firebasestorage.app",
  messagingSenderId: "340097404227",
  appId: "1:340097404227:web:554901219608cbed42f3f6"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const payOrdersRef = ref(db, 'pay_orders'); // 這是雲端儲存訂單的房間

let payOrders = []; // 本地暫存，用於畫面顯示

// 1. 監聽雲端資料 (手機電腦會同步收到通知)
onValue(payOrdersRef, (snapshot) => {
    const data = snapshot.val();
    payOrders = data || []; // 如果雲端是空的，就給空陣列
    renderPayTable(); // 資料變動時，自動重新畫表格
});

// 儲存到雲端 (取代原本的 localStorage)
function savePayOrders() {
    set(payOrdersRef, payOrders)
        .then(() => { console.log('同步成功'); })
        .catch((err) => { alert('同步失敗，請檢查網路'); console.error(err); });
}

// 2. 核心：日期計算工具 (精準邏輯)
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

// 撥款日計算邏輯
function calculatePaymentDate(platform, pickupDateStr) {
    if (!pickupDateStr) return { settlement: '-', payment: '-' };
    const pickupDate = new Date(pickupDateStr);
    const dow = pickupDate.getDay(); 
    let settlementDate, paymentDate;

    if (platform.includes('賣貨便')) {
        // 賣貨便：週一~三(+4天撥款)，週四~日(+2天撥款)
        if (dow >= 1 && dow <= 3) { 
            settlementDate = getNextWeekday(pickupDate, 4);
            paymentDate = addDays(settlementDate, 4);
        } else {
            settlementDate = getNextWeekday(pickupDate, 1);
            paymentDate = addDays(settlementDate, 2);
        }
    } else {
        // 好賣+
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

// 3. 渲染列表
function renderPayTable() {
    const tbody = document.getElementById('payTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if (payOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#999; padding:20px;">☁️ 雲端目前無訂單，請新增或匯入</td></tr>`;
        return;
    }

    payOrders.forEach((order, index) => {
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
            <td>${order.shipDate}</td>
            <td>${order.deadline || '-'}</td>
            <td>${statusHtml}</td>
            <td><button class="btn btn-secondary btn-sm" onclick="deleteOrder(${index})">❌</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// 4. 操作功能 (匯出至 window 以便 HTML 呼叫)
window.addNewOrder = function() {
    const no = document.getElementById('addOrderNo').value;
    const name = document.getElementById('addName').value;
    const phone = document.getElementById('addPhone').value;
    if(!no || !name) return alert('請填寫完整資訊');
    
    payOrders.push({
        no: no.startsWith('#') ? no : '#'+no,
        name,
        phone,
        platform: document.getElementById('addPlatform').value,
        shipDate: document.getElementById('addShipDate').value,
        deadline: document.getElementById('addDeadline').value,
        pickupDate: null
    });
    savePayOrders(); // 存到雲端
    alert('新增成功！');
};

window.updateOrderPickup = function(index, dateStr) {
    if(dateStr) {
        payOrders[index].pickupDate = dateStr;
        savePayOrders(); // 存到雲端
        if(window.removeSMSOrder) window.removeSMSOrder(payOrders[index].no);
    }
};

window.resetOrderStatus = function(index) {
    if(confirm('重設為未取貨？')) {
        payOrders[index].pickupDate = null;
        savePayOrders();
    }
};

window.deleteOrder = function(index) {
    if(confirm('確定刪除？')) {
        payOrders.splice(index, 1);
        savePayOrders();
    }
};

// 批量功能
window.toggleSelectAllPay = function() {
    const checked = document.getElementById('selectAllPay').checked;
    document.querySelectorAll('.pay-chk').forEach(c => c.checked = checked);
};

function getSelectedIndices() {
    const chks = document.querySelectorAll('.pay-chk:checked');
    const indices = [];
    chks.forEach(c => indices.push(parseInt(c.dataset.idx)));
    return indices;
}

window.batchSetDate = function() {
    const indices = getSelectedIndices();
    if(indices.length === 0) return alert('請先勾選訂單');
    const dateVal = document.getElementById('batchDateInput').value;
    if(!dateVal) return alert('請先選擇日期');
    
    if(confirm(`將選取的 ${indices.length} 筆訂單設為 ${dateVal} 取貨？`)) {
        indices.forEach(i => {
            payOrders[i].pickupDate = dateVal;
            if(window.removeSMSOrder) window.removeSMSOrder(payOrders[i].no);
        });
        savePayOrders();
    }
};

window.batchDeleteOrders = function() {
    const indices = getSelectedIndices();
    if(indices.length === 0) return;
    if(confirm(`刪除 ${indices.length} 筆？`)) {
        indices.sort((a,b) => b-a).forEach(i => payOrders.splice(i, 1));
        savePayOrders();
        document.getElementById('selectAllPay').checked = false;
    }
};

window.pushToSMS = function() {
    const indices = getSelectedIndices();
    if(indices.length === 0) return alert('請先勾選訂單');
    const dataToSync = indices.map(i => payOrders[i]);
    
    if(window.receiveOrdersFromPay) {
        window.receiveOrdersFromPay(dataToSync);
        alert(`已同步 ${indices.length} 筆訂單到 SMS 系統！`);
        switchMainTab('sms');
    } else {
        alert('SMS 模組尚未載入，請稍候');
    }
};

window.importFromText = function() {
    const txt = document.getElementById('importText').value;
    if(!txt) return;
    const lines = txt.split('\n');
    let count = 0;
    lines.forEach(line => {
        const cols = line.split(/[|\t,]/).map(c=>c.trim());
        if(cols.length >= 3) {
            payOrders.push({
                no: cols[0], name: cols[1], phone: cols[2], 
                platform: cols[3]||'賣貨便', shipDate: cols[4]||'', pickupDate: null
            });
            count++;
        }
    });
    savePayOrders();
    alert(`匯入 ${count} 筆`);
    document.getElementById('importText').value = '';
};

// 計算機功能
window.doCalc = function() {
    const p = document.getElementById('calcPlatform').value;
    const d = document.getElementById('calcDate').value;
    if(!d) return;
    const res = calculatePaymentDate(p, d);
    document.getElementById('calcResult').innerText = `💰 預計撥款日：${res.payment}`;
};
