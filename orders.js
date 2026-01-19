// 模擬資料 (如果沒有 Firebase，會用這個測試)
let orders = []; 

// 1. 初始化：載入時執行
window.addEventListener('DOMContentLoaded', () => {
  // 如果有 Firebase，這裡應該是讀取資料庫
  // 這裡先用模擬資料示範，讓您看到效果
  /* orders = [
    { orderNo: '1001', name: '王小明', phone: '0912345678', platform: '賣貨便', store: '台北門市', isPickedUp: false },
    { orderNo: '1002', name: '陳小美', phone: '0988777666', platform: '好賣+', store: '台中門市', isPickedUp: true, pickupDate: '2026-01-20' }
  ];
  */
  renderOrders();
});

// 2. 渲染訂單列表 (核心功能)
function renderOrders() {
  const listContainer = document.getElementById('orderList');
  listContainer.innerHTML = ''; // 清空畫面

  if (orders.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">🌸 目前沒有訂單，請從上方匯入</div>';
    return;
  }

  orders.forEach((item, index) => {
    // 防呆：如果資料是 undefined，顯示空字串
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
          ✅ 已取貨 (${item.pickupDate || '未知日期'})
        </button>
        <button class="btn small" style="margin-left:5px; font-size:12px;" onclick="resetStatus(${index})">↩️</button>
      `;
    } else {
      // 狀態：待取貨 (點擊後觸發 pickDate 函式)
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

// 3. 觸發日期選擇 (您要的功能！)
function pickDate(index) {
    // 建立一個隱藏的日期輸入框
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    // 預設為今天
    dateInput.value = new Date().toISOString().split('T')[0];
    
    // 當使用者選好日期後
    dateInput.onchange = (e) => {
        const selectedDate = e.target.value;
        if (selectedDate) {
            orders[index].isPickedUp = true;
            orders[index].pickupDate = selectedDate;
            console.log(`訂單 ${index} 更新為已取貨: ${selectedDate}`);
            renderOrders(); // 重新整理畫面
            // TODO: 記得在這裡呼叫 Firebase save() 
        }
    };

    // 自動彈出日期選單
    // 注意：showPicker() 支援 Chrome/Edge/iOS 15+
    try {
        dateInput.showPicker();
    } catch (err) {
        // 如果瀏覽器不支援，就直接把它加到畫面上讓使用者點
        alert('請手動輸入日期');
        // 這裡可以做降級處理，但通常現代瀏覽器都支援了
    }
}

// 4. 重置狀態 (如果不小心按錯)
function resetStatus(index) {
    if(confirm('要將此訂單恢復為「未取貨」狀態嗎？')) {
        orders[index].isPickedUp = false;
        orders[index].pickupDate = null;
        renderOrders();
    }
}

// 5. 批量匯入邏輯 (解決 Excel 格式問題)
function bulkImportFromText() {
    const inputVal = document.getElementById('bulkInput').value;
    if (!inputVal.trim()) {
        alert('請先貼上資料喔！');
        return;
    }

    // 依據換行符號切割每一行
    const rows = inputVal.split(/\n/);
    
    rows.forEach(row => {
        // 忽略空白行
        if(!row.trim()) return;

        // 支援逗號(CSV) 或 Tab(Excel複製) 分隔
        // 這行正則表達式會自動判斷是用逗號還是 Tab 隔開
        let cols = row.split(/,|\t/);
        
        // 清除每個欄位的多餘空白
        cols = cols.map(c => c.trim());

        // 確保至少有編號跟姓名
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
        }
    });

    document.getElementById('bulkInput').value = ''; // 清空輸入框
    renderOrders(); // 更新列表
    alert(`成功匯入 ${rows.length} 筆資料！`);
}

// 綁定按鈕 (確保 HTML 有這些 ID)
document.getElementById('bulkImportBtn').onclick = bulkImportFromText;

// 刪除選取功能
document.getElementById('deleteSelectedBtn').onclick = () => {
    // 找出有被勾選的 index (從後面往前刪，才不會影響 index 順序)
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    if(checkboxes.length === 0) {
        alert('還沒勾選任何訂單喔！');
        return;
    }

    if(!confirm(`確定要刪除這 ${checkboxes.length} 筆訂單嗎？`)) return;

    // 轉換成陣列並反轉，方便刪除
    const indexesToDelete = Array.from(checkboxes)
                                 .map(cb => parseInt(cb.dataset.index))
                                 .sort((a, b) => b - a);

    indexesToDelete.forEach(idx => {
        orders.splice(idx, 1);
    });

    renderOrders();
};
