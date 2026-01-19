// 模擬資料
let orders = []; 

// 1. 初始化
window.addEventListener('DOMContentLoaded', () => {
  renderOrders();
  renderRecentOrders();
});

// --- 核心功能 1: 新增訂單 (修復報錯問題) ---
function addOrderFromForm() {
    const name = document.getElementById('name').value;
    // 簡單驗證
    if (!name) { alert('請填寫客戶姓名喔！'); return; }

    const newOrder = {
        orderNo: document.getElementById('orderNo').value || '無編號',
        name: name,
        phone: document.getElementById('phone').value,
        platform: document.getElementById('platform').value,
        store: document.getElementById('store').value,
        pickupDeadline: document.getElementById('pickupDeadline').value,
        isPickedUp: false // 預設未取貨
    };

    orders.push(newOrder);
    renderOrders();
    renderRecentOrders();
    
    // 清空表單並跳回第一步 (增加使用者體驗)
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('orderNo').value = '';
    alert('✨ 新增成功！');
}

// 顯示最近新增的小清單
function renderRecentOrders() {
    const container = document.getElementById('recentOrders');
    if(!container) return;
    container.innerHTML = '';
    const recent = orders.slice(-3).reverse();
    recent.forEach(item => {
        container.innerHTML += `<div style="padding:8px; border-bottom:1px solid #eee;">🆕 ${item.name} (${item.platform})</div>`;
    });
}

// --- 核心功能 2: 渲染列表 (包含紅綠燈樣式) ---
function renderOrders() {
  const listContainer = document.getElementById('orderList');
  if(!listContainer) return;
  listContainer.innerHTML = ''; 

  if (orders.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">🌸 目前沒有訂單，請從上方匯入或新增</div>';
    return;
  }

  orders.forEach((item, index) => {
    // 判斷平台標籤顏色
    const p = item.platform || '';
    const badgeClass = p.includes('賣貨便') ? 'seven' : (p.includes('好賣') ? 'fami' : '');

    // --- 重點修改：按鈕樣式邏輯 ---
    let btnHtml = '';
    if (item.isPickedUp) {
      // ✅ 狀態：已取貨 (綠色背景)
      btnHtml = `
        <button class="btn small" style="background:#e6f9e6; color:#28a745; border:1px solid #28a745; cursor:default;">
          ✅ 已取貨 (${item.pickupDate})
        </button>
        <button class="btn small" style="margin-left:5px; padding:5px 8px; font-size:12px;" onclick="resetStatus(${index})" title="復原">↩️</button>
      `;
    } else {
      // 📦 狀態：未取貨 (紅字白底，加強邊框)
      // 注意：這裡傳入了 'this'，讓日期選單知道按鈕在哪裡
      btnHtml = `
        <button class="btn small" style="background:white; color:#ff6b6b; border:1px solid #ff6b6b; font-weight:bold;" onclick="pickDate(${index}, this)">
          📦 未取貨
        </button>
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
        <div class="col-action" style="position:relative;"> ${btnHtml}
        </div>
      </div>
    `;
    listContainer.innerHTML += html;
  });
}

// --- 核心功能 3: 日期選擇 (修復位置亂跑) ---
function pickDate(index, btnElement) {
    // 1. 建立日期輸入框
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = new Date().toISOString().split('T')[0];
    
    // 2. 設定樣式：讓它變成透明的，蓋在按鈕附近，或者暫時隱藏
    dateInput.style.position = 'absolute';
    dateInput.style.opacity = 0; 
    dateInput.style.top = '100%'; // 放在按鈕下方
    dateInput.style.left = '0';

    // 3. 綁定變更事件
    dateInput.onchange = (e) => {
        if (e.target.value) {
            orders[index].isPickedUp = true;
            orders[index].pickupDate = e.target.value;
            renderOrders(); 
        }
        // 選完後移除自己
        dateInput.remove();
    };
    
    // 4. 取消選擇時也要移除
    dateInput.onblur = () => { setTimeout(() => dateInput.remove(), 200); };

    // 5. 【關鍵】把輸入框「加入」到按鈕的父層容器中，而不是丟到最外層
    btnElement.parentElement.appendChild(dateInput);

    // 6. 觸發顯示
    try {
        dateInput.showPicker();
    } catch (err) {
        // 舊瀏覽器備案
        dateInput.style.opacity = 1;
        dateInput.focus();
    }
}

function resetStatus(index) {
    if(confirm('確定要復原成「未取貨」狀態嗎？')) {
        orders[index].isPickedUp = false;
        renderOrders();
    }
}

// 批量匯入 & 刪除功能 (保持不變)
function bulkImportFromText() {
    const inputVal = document.getElementById('bulkInput').value;
    if (!inputVal.trim()) { alert('請先貼上資料！'); return; }
    const rows = inputVal.split(/\n/);
    rows.forEach(row => {
        if(!row.trim()) return;
        let cols = row.split(/\t|,/); // 支援 Excel Tab 或 CSV 逗號
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
