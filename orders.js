// 模擬資料 (如果沒有 Firebase，會用這個測試)
let orders = []; 

// 1. 初始化
window.addEventListener('DOMContentLoaded', () => {
  renderOrders();
  renderRecentOrders(); // 也要渲染「最近新增」的小清單
});

// --- 核心功能 1: 新增訂單 (補回這個功能！) ---
function addOrderFromForm() {
    // 取得輸入框資料
    const orderNo = document.getElementById('orderNo').value;
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const platformSelect = document.getElementById('platform');
    const platform = platformSelect.options[platformSelect.selectedIndex].text; // 抓取選單文字
    
    // 選填資料
    const store = document.getElementById('store').value;
    const pickupDeadline = document.getElementById('pickupDeadline').value;

    // 簡單驗證
    if (!name) {
        alert('請填寫客戶姓名喔！');
        return;
    }

    // 建立新訂單物件
    const newOrder = {
        orderNo: orderNo || '無編號',
        name: name,
        phone: phone,
        platform: platform,
        store: store,
        pickupDeadline: pickupDeadline,
        isPickedUp: false // 預設未取貨
    };

    // 加入陣列
    orders.push(newOrder);
    
    // 更新畫面
    renderOrders();
    renderRecentOrders(); // 更新「剛剛新增的訂單」區域
}

// 輔助功能: 顯示最近新增的幾筆 (讓使用者確認有新增成功)
function renderRecentOrders() {
    const container = document.getElementById('recentOrders');
    if(!container) return;
    
    container.innerHTML = '';
    // 只顯示最後 3 筆，並反轉順序 (最新的在上面)
    const recent = orders.slice(-3).reverse();
    
    if(recent.length === 0) {
        container.innerHTML = '<div style="padding:10px; color:#ccc;">尚無新增紀錄</div>';
        return;
    }

    recent.forEach(item => {
        container.innerHTML += `
            <div style="border-bottom:1px solid #eee; padding:10px; font-size:0.9rem; display:flex; align-items:center;">
               <span style="color:#ff8fab; margin-right:8px;">●</span> 
               <strong>${item.name}</strong> 
               <span style="color:#999; margin-left:auto; font-size:0.8rem;">${item.platform}</span>
            </div>
        `;
    });
}

// --- 核心功能 2: 渲染列表 & 日期選擇 ---
function renderOrders() {
  const listContainer = document.getElementById('orderList');
  if(!listContainer) return;
  
  listContainer.innerHTML = ''; // 清空列表

  if (orders.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center; padding:40px; color:#999; background:#fff; border-radius:12px;">🌸 目前沒有訂單，請從上方匯入</div>';
    return;
  }

  orders.forEach((item, index) => {
    const orderNo = item.orderNo || '無編號';
    const name = item.name || '未知';
    const phone = item.phone || '';
    const platform = item.platform || '其他';
    
    // 判斷平台顏色 CSS
    const badgeClass = platform.includes('賣貨便') ? 'seven' : (platform.includes('好賣') ? 'fami' : '');

    // 決定按鈕顯示什麼
    let btnHtml = '';
    if (item.isPickedUp) {
      // 狀態：已取貨
      btnHtml = `
        <button class="btn small" style="background:#eee; color:#999; cursor:default;">
          ✅ 已取貨 (${item.pickupDate || '未知'})
        </button>
        <button class="btn small" style="margin-left:5px; padding:5px 10px;" onclick="resetStatus(${index})" title="復原為未取貨">↩️</button>
      `;
    } else {
      // 狀態：待取貨 (點擊後觸發 pickDate)
      btnHtml = `
        <button class="btn small primary" onclick="pickDate(${index})">
          📦 待取貨
        </button>
      `;
    }

    const html = `
      <div class="order-item">
        <div class="col-check">
          <input type="checkbox" data-index="${index}" class="order-checkbox">
        </div>

        <div class="col-info">
          <strong>#${orderNo}</strong>
          <span class="platform-badge ${badgeClass}">${platform}</span>
        </div>

        <div class="col-customer">
          <div>👤 ${name} <span style="color:var(--text-light); margin-left:5px;">📞 ${phone}</span></div>
          <div style="font-size:12px; color:#888;">📍 ${item.store || '未指定門市'}</div>
        </div>

        <div class="col-action">
           ${btnHtml}
        </div>
      </div>
    `;
    listContainer.innerHTML += html;
  });
}

// 觸發日期選擇
function pickDate(index) {
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = new Date().toISOString().split('T')[0]; // 預設今天
    
    dateInput.onchange = (e) => {
        const selectedDate = e.target.value;
        if (selectedDate) {
            orders[index].isPickedUp = true;
            orders[index].pickupDate = selectedDate;
            renderOrders(); // 重整畫面
        }
    };

    // 嘗試自動彈出日期選單
    try {
        dateInput.showPicker();
    } catch (err) {
        // 如果瀏覽器不支援 showPicker，改用 prompt 或是直接設為今天
        const manualDate = prompt("請輸入取貨日期 (YYYY-MM-DD):", dateInput.value);
        if(manualDate) {
             orders[index].isPickedUp = true;
             orders[index].pickupDate = manualDate;
             renderOrders();
        }
    }
}

function resetStatus(index) {
    if(confirm('要將此訂單恢復為「未取貨」狀態嗎？')) {
        orders[index].isPickedUp = false;
        orders[index].pickupDate = null;
        renderOrders();
    }
}

// 批量匯入邏輯
function bulkImportFromText() {
    const inputVal = document.getElementById('bulkInput').value;
    if (!inputVal || !inputVal.trim()) {
        alert('請先貼上 Excel 資料喔！');
        return;
    }

    const rows = inputVal.split(/\n/);
    let count = 0;
    
    rows.forEach(row => {
        if(!row.trim()) return;
        // 支援 Tab (Excel) 或 逗號 (CSV)
        let cols = row.split(/\t|,/);
        cols = cols.map(c => c.trim());

        // 至少要有 2 個欄位才匯入
        if(cols.length >= 2) {
            const newOrder = {
                orderNo: cols[0],
                name: cols[1],
                phone: cols[2] || '',
                platform: cols[3] || '未知',
                store: cols[4] || '',
                pickupDeadline: cols[5] || '',
                isPickedUp: false
            };
            orders.push(newOrder);
            count++;
        }
    });

    document.getElementById('bulkInput').value = ''; 
    renderOrders(); 
    alert(`成功匯入 ${count} 筆資料！`);
}

// 綁定按鈕事件
const importBtn = document.getElementById('bulkImportBtn');
if(importBtn) importBtn.onclick = bulkImportFromText;

const deleteBtn = document.getElementById('deleteSelectedBtn');
if(deleteBtn) {
    deleteBtn.onclick = () => {
        const checkboxes = document.querySelectorAll('.order-checkbox:checked');
        if(checkboxes.length === 0) {
            alert('還沒勾選任何訂單喔！');
            return;
        }

        if(!confirm(`確定要刪除這 ${checkboxes.length} 筆訂單嗎？`)) return;

        const indexesToDelete = Array.from(checkboxes)
                                     .map(cb => parseInt(cb.dataset.index))
                                     .sort((a, b) => b - a);

        indexesToDelete.forEach(idx => {
            orders.splice(idx, 1);
        });

        renderOrders();
        // 也要記得取消全選按鈕的狀態（這裡省略複雜邏輯，直接重整就好）
    };
}

// 全選與清除
const selectAllBtn = document.getElementById('selectAllBtn');
if(selectAllBtn) {
    selectAllBtn.onclick = () => {
        document.querySelectorAll('.order-checkbox').forEach(cb => cb.checked = true);
    };
}

const clearBtn = document.getElementById('clearSelectionBtn');
if(clearBtn) {
    clearBtn.onclick = () => {
        document.querySelectorAll('.order-checkbox').forEach(cb => cb.checked = false);
    };
}
