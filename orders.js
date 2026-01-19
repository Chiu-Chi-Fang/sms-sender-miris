// orders.js - 處理訂單資料、日期計算

// 1. 初始化資料 (從 LocalStorage 讀取，避免重整消失)
let payOrders = JSON.parse(localStorage.getItem('payOrders')) || [];

function savePayOrders() {
    localStorage.setItem('payOrders', JSON.stringify(payOrders));
}

// 2. 核心：日期計算邏輯
function calculatePaymentDate(platform, pickupDateStr) {
    if (!pickupDateStr) return { settlement: '-', payment: '-' };
    const date = new Date(pickupDateStr);
    const day = date.getDay(); // 0=週日
    
    // 簡單推算：賣貨便(週四結算,下週一匯款)、好賣+(週三/五結算)
    // 這裡使用簡化邏輯演示，您可以根據實際需求微調天數
    let daysToAdd = 7; 
    if(platform.includes('賣貨便')) {
        // 假設邏輯：週一~週三取 -> 下週四撥款 (約+8~10天)
        daysToAdd = 10; 
    } else {
        // 好賣+
        daysToAdd = 8;
    }
    
    const payDate = new Date(date);
    payDate.setDate(date.getDate() + daysToAdd);
    
    return {
        settlement: pickupDateStr, // 簡化顯示
        payment: payDate.toISOString().split('T')[0]
    };
}

// 3. 渲染訂單列表 (包含隱形按鈕)
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
                    <div style="font-size:12px; color:#ff6b81; font-weight:bold; margin-top:2px;">
                        💰 撥款: ${calc.payment}
                    </div>
                </div>
            `;
        } else {
            // 未取貨：顯示紅色按鈕 + 隱形日期選單 (修復選單飛走的問題)
            // 注意 class="action-wrapper" 和 class="hidden-date-input"
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
    // switchPaySubTab('orders'); // 可選擇是否自動切換回列表
}

function updateOrderPickup(index, dateStr) {
    if(dateStr) {
        payOrders[index].pickupDate = dateStr;
        savePayOrders();
        renderPayTable();
        
        // ★ 自動連動 SMS：刪除該訂單 (如果有的話)
        if(window.removeSMSOrder) {
            window.removeSMSOrder(payOrders[index].no);
        }
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

// 5. 批量功能 (包含您要求的新功能)
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

// ★★★ 新功能：批量指定日期 ★★★
function batchSetDate() {
    const indices = getSelectedIndices();
    if(indices.length === 0) return alert('請先勾選訂單');
    
    const dateVal = document.getElementById('batchDateInput').value;
    if(!dateVal) return alert('請先選擇日期');
    
    if(confirm(`將選取的 ${indices.length} 筆訂單設為 ${dateVal} 取貨？`)) {
        indices.forEach(i => {
            payOrders[i].pickupDate = dateVal;
            // 連動刪除 SMS
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
        // 從後面刪回來才不會影響 index
        indices.sort((a,b) => b-a).forEach(i => payOrders.splice(i, 1));
        savePayOrders();
        renderPayTable();
        document.getElementById('selectAllPay').checked = false;
    }
}

// 傳送資料給 SMS 模組
function pushToSMS() {
    const indices = getSelectedIndices();
    if(indices.length === 0) return alert('請先勾選訂單');
    
    const dataToSync = indices.map(i => payOrders[i]);
    
    // 呼叫 sms.js 的函數 (透過 window 全域變數)
    if(window.receiveOrdersFromPay) {
        window.receiveOrdersFromPay(dataToSync);
        alert(`已同步 ${indices.length} 筆訂單到 SMS 系統！`);
        // 切換分頁
        switchMainTab('sms');
    } else {
        alert('SMS 模組尚未載入，請稍候');
    }
}

// 匯入功能
function importFromText() {
    const txt = document.getElementById('importText').value;
    if(!txt) return;
    const lines = txt.split('\n');
    let count = 0;
    lines.forEach(line => {
        const cols = line.split(/[|\t,]/).map(c=>c.trim()); // 支援 | 或 tab 或 逗號
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

// 讓 HTML 按鈕找得到這些函數
window.renderPayTable = renderPayTable;
window.addNewOrder = addNewOrder;
window.updateOrderPickup = updateOrderPickup;
window.resetOrderStatus = resetOrderStatus;
window.deleteOrder = deleteOrder;
window.toggleSelectAllPay = toggleSelectAllPay;
window.batchSetDate = batchSetDate; // 綁定新功能
window.batchDeleteOrders = batchDeleteOrders;
window.pushToSMS = pushToSMS;
window.importFromText = importFromText;
