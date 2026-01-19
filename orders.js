// orders.js - 雲端同步版 (修復批量匯入)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// ★★★ 請填入您的 Firebase 設定 ★★★
const firebaseConfig = {
  apiKey: "AIzaSyDcKclyNssDs08E0DIwfrc7lzq3QQL4QS8",
  authDomain: "sms-miris.firebaseapp.com",
  databaseURL: "https://sms-miris-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sms-miris",
  storageBucket: "sms-miris.firebasestorage.app",
  messagingSenderId: "340097404227",
  appId: "1:340097404227:web:554901219608cbed42f3f6"
};

// 初始化
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

// 儲存到雲端
function savePayOrders() {
    set(payOrdersRef, payOrders)
        .then(() => console.log('同步成功'))
        .catch((err) => alert('同步失敗，請檢查網路'));
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

    if (platform && platform.includes('賣貨便')) {
        if (dow >= 1 && dow <= 3) { 
            settlementDate = getNextWeekday(pickupDate, 4);
            paymentDate = addDays(settlementDate, 4);
        } else {
            settlementDate = getNextWeekday(pickupDate, 1);
            paymentDate = addDays(settlementDate, 2);
        }
    } else {
        // 好賣+ (預設)
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
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#999; padding:20px;">☁️ 目前無訂單，請從 Excel 複製貼上</td></tr>`;
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

// ==========================================
// ★★★ 重點修改：增強版匯入功能 ★★★
// ==========================================
window.importFromText = function() {
    const txt = document.getElementById('importText').value;
    if(!txt) return alert('請先貼上資料喔！');

    const lines = txt.split('\n');
    let count = 0;

    lines.forEach(line => {
        if(!line.trim()) return;

        // 修改點：這裡加入了 \s+，這代表「空白鍵」也會被當作分隔符號
        // 這樣您的資料 "#1489 謝毓潔" 就能被正確切開了
        const cols = line.split(/[|\t,\s]+/).filter(c => c.trim() !== '');

        // 確保至少有 3 個欄位 (訂單號、姓名、電話)
        if(cols.length >= 3) {
            payOrders.push({
                no: cols[0],
                name: cols[1],
                phone: cols[2],
                platform: cols[3] || '賣貨便',
                shipDate: cols[4] || '', // 出貨日
                deadline: cols[5] || '', // 期限
                pickupDate: null
            });
            count++;
        }
    });

    if(count > 0) {
        savePayOrders();
        alert(`成功匯入 ${count} 筆資料！`);
        document.getElementById('importText').value = '';
    } else {
        alert('匯入失敗：格式不符。\n請確認每行有「訂單號 姓名 電話」');
    }
};

// 綁定其他全域功能
window.addNewOrder = function() {
    const no = document.getElementById('addOrderNo').value;
    const name = document.getElementById('addName').value;
    const phone = document.getElementById('addPhone').value;
    if(!no || !name) return alert('請填寫完整資訊');
    
    payOrders.push({
        no: no.startsWith('#') ? no : '#'+no,
        name, phone,
        platform: document.getElementById('addPlatform').value,
        shipDate: document.getElementById('addShipDate').value,
        deadline: document.getElementById('addDeadline').value,
        pickupDate: null
    });
    savePayOrders();
    alert('新增成功！');
};

window.updateOrderPickup = function(index, dateStr) {
    if(dateStr) {
        payOrders[index].pickupDate = dateStr;
        savePayOrders();
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
        indices.forEach(i => {
            payOrders[i].pickupDate = dateVal;
            if(window.removeSMSOrder) window.removeSMSOrder(payOrders[i].no);
        });
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
    } else {
        alert('SMS 模組尚未載入，請稍候');
    }
};

window.doCalc = function() {
    const p = document.getElementById('calcPlatform').value;
    const d = document.getElementById('calcDate').value;
    if(!d) return;
    const res = calculatePaymentDate(p, d);
    document.getElementById('calcResult').innerText = `💰 預計撥款日：${res.payment}`;
};
