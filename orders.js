// 模擬資料
let orders = []; 

// 1. 初始化
window.addEventListener('DOMContentLoaded', () => {
  renderOrders();
  renderRecentOrders();
});

// --- 功能 1: 新增訂單 ---
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
        isPickedUp: false 
    };

    orders.push(newOrder);
    renderOrders();
    renderRecentOrders();
    
    // 清空表單
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

// --- 功能 2: 渲染列表 (關鍵修改在這邊！) ---
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

    // --- 按鈕區域邏輯 ---
    let btnHtml = '';
    
    if (item.isPickedUp) {
      // ✅ 狀態：已取貨 (顯示綠色，點擊箭頭復原)
      btnHtml = `
        <div style="display:flex; align-items:center; justify-content:flex-end; gap:5px;">
            <button class="btn small" style="background:#e6f9e6; color:#28a745; border:1px solid #28a745; cursor:default;">
              ✅ 已取貨 (${item.pickupDate})
            </button>
            <button class="btn small" style="padding:5px 10px;" onclick="resetStatus(${index})" title="復原為未取貨">↩️</button>
        </div>
      `;
    } else {
      // 📦 狀態：未取貨 (使用隱形覆蓋術)
      // 原理：外層是一個相對定位的 div，裡面放按鈕和一個透明的 date input
      // input 蓋在 button 上面，點擊時觸發瀏覽器原生日期選單
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
        </div>
      </div>
    `;
    listContainer.innerHTML += html;
  });
}

// --- 功能 3: 狀態更新函式 ---

// 當使用者透過透明選單選好日期時觸發
function onDatePicked(index, dateValue) {
    if (dateValue) {
        orders[index].isPickedUp = true;
        orders[index].pickupDate = dateValue;
        renderOrders(); // 重新整理畫面
    }
}

function resetStatus(index) {
    if(confirm('確定要復原成「未取貨」狀態嗎？')) {
        orders[index].isPickedUp = false;
        renderOrders();
    }
}

// --- 功能 4: 批量匯入 & 刪除 (保持不變) ---
function bulkImportFromText() {
    const inputVal = document.getElementById('bulkInput').value;
    if (!inputVal.trim()) { alert('請先貼上資料！'); return; }
    const rows = inputVal.split(/\n/);
    rows.forEach(row => {
        if(!row.trim()) return;
        let cols = row.split(/\t|,/); 
        cols = cols.map(c => c.trim());
        if(cols.length >= 2) {
            orders.push({
                orderNo: cols[0], name: cols[1], phone: cols[2]||'', platform: cols[3]||'賣貨便', 
                store: cols[4]||'', isPickedUp: false
            });
        }
    });
    document.getElementById('bulkInput').value = '';
    renderOrders();
}

// 綁定按鈕
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
