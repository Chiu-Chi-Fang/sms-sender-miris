// ==========================================
//  工具函式：日期計算邏輯 (源自您的舊系統)
// ==========================================
function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function getNextWeekday(date, targetDay) {
    const d = new Date(date);
    const cur = d.getDay(); // 0=週日, 1=週一...
    let add = targetDay - cur;
    if (add <= 0) add += 7;
    d.setDate(d.getDate() + add);
    return d;
}

function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// 核心：根據平台與取貨日，計算撥款日
function calculatePaymentDate(platform, pickupDateStr) {
    const pickupDate = new Date(pickupDateStr);
    const dow = pickupDate.getDay();
    let settlementDate, paymentDate;

    // 邏輯移植自您的舊檔案
    if (platform.includes('賣貨便')) {
        if (dow >= 1 && dow <= 3) { // 週一至週三
            settlementDate = getNextWeekday(pickupDate, 4); // 下週四
            paymentDate = addDays(settlementDate, 4);
        } else { // 週四至週日
            settlementDate = getNextWeekday(pickupDate, 1); // 下週一
            paymentDate = addDays(settlementDate, 2);
        }
    } else if (platform.includes('好賣')) { // 好賣+
        if (dow >= 1 && dow <= 3) { // 週一至週三
            settlementDate = getNextWeekday(pickupDate, 5); // 下週五
            paymentDate = addDays(settlementDate, 4);
        } else { // 週四至週日
            settlementDate = getNextWeekday(pickupDate, 3); // 下週三
            paymentDate = addDays(settlementDate, 1);
        }
    } else {
        return null; // 其他平台無法計算
    }

    return {
        settlement: formatDate(settlementDate),
        payment: formatDate(paymentDate)
    };
}

// ==========================================
//  主程式邏輯
// ==========================================

let orders = []; 

// 1. 初始化
window.addEventListener('DOMContentLoaded', () => {
  renderOrders();
  renderRecentOrders();
});

// --- 功能: 新增訂單 ---
function addOrderFromForm() {
    const name = document.getElementById('name').value;
    if (!name) { alert('請填寫客戶姓名喔！'); return; }

    const newOrder = {
        orderNo: document.getElementById('orderNo').value || '無編號',
        name: name,
        phone: document.getElementById('phone').value,
        platform: document.getElementById('platform').value,
        store: document.getElementById('store').value,
        pickupDeadline: document.getElementById('pickupDeadline').value,
        isPickedUp: false,
        pickupDate: null,
        paymentDate: null // 新增：預計撥款日
    };

    orders.push(newOrder);
    renderOrders();
    renderRecentOrders();
    
    // 重置表單
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('orderNo').value = '';
    alert('✨ 新增成功！');
}

function renderRecentOrders() {
    const container = document.getElementById('recentOrders');
    if(!container) return;
    container.innerHTML = '';
    const recent = orders.slice(-3).reverse();
    recent.forEach(item => {
        container.innerHTML += `<div style="padding:8px; border-bottom:1px solid #eee;">🆕 ${item.name} (${item.platform})</div>`;
    });
}

// --- 功能: 渲染列表 (顯示計算結果) ---
function renderOrders() {
  const listContainer = document.getElementById('orderList');
  if(!listContainer) return;
  listContainer.innerHTML = ''; 

  if (orders.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">🌸 目前沒有訂單，請從上方匯入或新增</div>';
    return;
  }

  orders.forEach((item, index) => {
    const p = item.platform || '';
    const badgeClass = p.includes('賣貨便') ? 'seven' : (p.includes('好賣') ? 'fami' : '');

    // --- 按鈕與狀態邏輯 ---
    let btnHtml = '';
    let statusHtml = ''; // 用來顯示撥款日

    if (item.isPickedUp) {
      // ✅ 狀態：已取貨
      btnHtml = `
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
            <div style="display:flex; align-items:center; gap:5px;">
                <button class="btn small" style="background:#e6f9e6; color:#28a745; border:1px solid #28a745; cursor:default;">
                ✅ 已取貨 (${item.pickupDate.slice(5)}) 
                </button>
                <button class="btn small" style="padding:4px 8px;" onclick="resetStatus(${index})" title="重設狀態">↩️</button>
            </div>
        </div>
      `;
      
      // 如果有計算出撥款日，顯示在下面
      if (item.paymentDate) {
          statusHtml = `
            <div style="margin-top:5px; font-size:13px; color:#d63384; font-weight:bold; text-align:right;">
                💰 預計撥款：${item.paymentDate}
            </div>
          `;
      }

    } else {
      // 📦 狀態：未取貨 (隱形覆蓋術：日期選單)
      btnHtml = `
        <div style="position: relative; display: inline-block;">
            <button class="btn small" style="background:white; color:#ff6b6b; border:1px solid #ff6b6b; font-weight:bold; pointer-events: none;">
              📦 未取貨
            </button>
            <input type="date" 
                   style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;"
                   onchange="onDatePicked(${index}, this.value)"
            >
        </div>
      `;
    }

    const html = `
      <div class="order-item">
        <div class="col-check"><input type="checkbox" data-index="${index}" class="order-checkbox"></div>
        <div class="col-info">
          <strong>#${item.orderNo}</strong>
          <span class="platform-badge ${badgeClass}">${p}</span>
        </div>
        <div class="col-customer">
          <div>👤 ${item.name} <span style="color:#999;font-size:0.9em">📞 ${item.phone}</span></div>
          <div style="font-size:12px; color:#888;">📍 ${item.store || '未指定'}</div>
        </div>
        <div class="col-action">
           ${btnHtml}
           ${statusHtml}
        </div>
      </div>
    `;
    listContainer.innerHTML += html;
  });
}

// --- 功能: 日期被選擇後的處理 (觸發計算) ---
function onDatePicked(index, dateValue) {
    if (dateValue) {
        const order = orders[index];
        order.isPickedUp = true;
        order.pickupDate = dateValue;

        // 觸發核心計算
        const result = calculatePaymentDate(order.platform, dateValue);
        
        if (result) {
            order.paymentDate = result.payment; // 存入撥款日
            // 也可以存入結算日 order.settlementDate = result.settlement;
        } else {
            order.paymentDate = null; // 平台不支援計算
        }

        renderOrders(); // 重新整理畫面
    }
}

function resetStatus(index) {
    if(confirm('確定要復原成「未取貨」狀態嗎？')) {
        orders[index].isPickedUp = false;
        orders[index].paymentDate = null;
        renderOrders();
    }
}

// --- 批量匯入 & 刪除 (保持不變) ---
function bulkImportFromText() {
    const inputVal = document.getElementById('bulkInput').value;
    if (!inputVal.trim()) { alert('請先貼上資料！'); return; }
    const rows = inputVal.split(/\n/);
    let count = 0;
    rows.forEach(row => {
        if(!row.trim()) return;
        let cols = row.split(/\t|,/); 
        cols = cols.map(c => c.trim());
        if(cols.length >= 2) {
            orders.push({
                orderNo: cols[0], name: cols[1], phone: cols[2]||'', platform: cols[3]||'賣貨便', 
                store: cols[4]||'', isPickedUp: false, paymentDate: null
            });
            count++;
        }
    });
    document.getElementById('bulkInput').value = '';
    renderOrders();
    alert(`成功匯入 ${count} 筆資料！`);
}

const importBtn = document.getElementById('bulkImportBtn');
if(importBtn) importBtn.onclick = bulkImportFromText;

const deleteBtn = document.getElementById('deleteSelectedBtn');
if(deleteBtn) deleteBtn.onclick = () => {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    if(checkboxes.length === 0) return;
    if(!confirm(`刪除這 ${checkboxes.length} 筆嗎？`)) return;
    const idxs = Array.from(checkboxes).map(c => parseInt(c.dataset.index)).sort((a,b)=>b-a);
    idxs.forEach(i => orders.splice(i,1));
    renderOrders();
};

const selectAllBtn = document.getElementById('selectAllBtn');
if(selectAllBtn) selectAllBtn.onclick = () => document.querySelectorAll('.order-checkbox').forEach(c=>c.checked=true);

const clearBtn = document.getElementById('clearSelectionBtn');
if(clearBtn) clearBtn.onclick = () => document.querySelectorAll('.order-checkbox').forEach(c=>c.checked=false);
