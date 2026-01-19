// orders.js - 處理訂單資料、日期計算 (修正撥款邏輯版)

// 1. 初始化資料
let payOrders = JSON.parse(localStorage.getItem('payOrders')) || [];

function savePayOrders() {
    localStorage.setItem('payOrders', JSON.stringify(payOrders));
}

// 2. 核心：日期計算工具 (恢復精準邏輯)
function getNextWeekday(date, targetDay) {
    const d = new Date(date);
    const cur = d.getDay(); // 0=週日
    let add = targetDay - cur;
    if (add <= 0) add += 7; // 如果是今天或已過，就找下週
    d.setDate(d.getDate() + add);
    return d;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

// 核心：撥款日計算
function calculatePaymentDate(platform, pickupDateStr) {
    if (!pickupDateStr) return { settlement: '-', payment: '-' };
    const pickupDate = new Date(pickupDateStr);
    const dow = pickupDate.getDay(); // 0=Sun, 1=Mon...

    let settlementDate, paymentDate;

    if (platform.includes('賣貨便')) {
        // --- 賣貨便邏輯 ---
        if (dow >= 1 && dow <= 3) { 
            // 週一(1) ~ 週三(3) 取貨 -> 下週四結算(4) -> 再+4天撥款
            settlementDate = getNextWeekday(pickupDate, 4);
            paymentDate = addDays(settlementDate, 4);
        } else {
            // 週四(4) ~ 週日(0) 取貨 -> 下週一結算(1) -> 再+2天撥款
            // 您的案例: 1/18(日) -> 下週一(1/19) -> +2天 = 1/21(三)
            settlementDate = getNextWeekday(pickupDate, 1);
            paymentDate = addDays(settlementDate, 2);
        }
    } else {
        // --- 好賣+ 邏輯 ---
        if (dow >= 1 && dow <= 3) {
            // 週一~週三 -> 下週五結算 -> +4天
            settlementDate = getNextWeekday(pickupDate, 5);
            paymentDate = addDays(settlementDate, 4);
        } else {
            // 週四~週日 -> 下週三結算 -> +1天
            settlementDate = getNextWeekday(pickupDate, 3);
            paymentDate = addDays(settlementDate, 1);
        }
    }

    return {
        settlement: settlementDate.toISOString().split('T')[0],
        payment: paymentDate.toISOString().split('T')[0]
    };
}

// 3. 渲染訂單列表
function renderPayTable() {
    const tbody = document.getElementById('payTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    payOrders.forEach((order, index) => {
        // 狀態按鈕 HTML
        let statusHtml = '';
        if (order.pickupDate) {
            // 已取貨：顯示綠色按鈕 + 撥款日
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
            // 未取貨：隱形日期選單
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

// 4. 操作功能
function addNewOrder() {
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
    savePayOrders();
    renderPayTable();
    alert('新增成功！');
}

function updateOrderPickup(index, dateStr) {
    if(dateStr) {
        payOrders[index].pickupDate = dateStr;
        savePayOrders();
        renderPayTable();
        // 連動 SMS 刪除
        if(window.removeSMSOrder) window.removeSMSOrder(payOrders[index].no);
    }
}

function resetOrderStatus(index) {
    if(confirm('重設為未取貨？')) {
        payOrders[index].pickupDate = null;
        savePayOrders();
        renderPayTable();
    }
}

function deleteOrder(index) {
    if(confirm('確定刪除？')) {
        payOrders.splice(index, 1);
        savePayOrders();
        renderPayTable();
    }
}

// 5. 批量功能
function toggleSelectAllPay() {
    const checked = document.getElementById('selectAllPay').checked;
    document.querySelectorAll('.pay-chk').forEach(c => c.checked = checked);
}

function getSelectedIndices() {
    const chks = document.querySelectorAll('.pay-chk:checked');
    const indices = [];
    chks.forEach(c => indices.push(parseInt(c.dataset.idx)));
    return indices;
}

// 批量指定日期
function batchSetDate() {
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
        renderPayTable();
    }
}

function batchDeleteOrders() {
    const indices = getSelectedIndices();
    if(indices.length === 0) return;
    if(confirm(`刪除 ${indices.length} 筆？`)) {
        indices.sort((a,b) => b-a).forEach(i => payOrders.splice(i, 1));
        savePayOrders();
        renderPayTable();
        document.getElementById('selectAllPay').checked = false;
    }
}

// 傳送給 SMS
function pushToSMS() {
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
}

// 匯入
function importFromText() {
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
    renderPayTable();
    alert(`匯入 ${count} 筆`);
    document.getElementById('importText').value = '';
}

// 綁定全域
window.renderPayTable = renderPayTable;
window.addNewOrder = addNewOrder;
window.updateOrderPickup = updateOrderPickup;
window.resetOrderStatus = resetOrderStatus;
window.deleteOrder = deleteOrder;
window.toggleSelectAllPay = toggleSelectAllPay;
window.batchSetDate = batchSetDate;
window.batchDeleteOrders = batchDeleteOrders;
window.pushToSMS = pushToSMS;
window.importFromText = importFromText;
