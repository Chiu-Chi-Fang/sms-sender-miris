// SMS 模組 JavaScript

// 初始化
document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('main-sms')) {
    initSMS();
  }
});

function initSMS() {
  console.log('SMS 模組初始化...');
  
  // 模擬雲端同步狀態
  setTimeout(() => {
    const statusEl = document.getElementById('sms-sync-status');
    if (statusEl) {
      statusEl.innerHTML = '<span style="color: #10b981;">✅ 雲端已連線（模擬）</span>';
    }
  }, 1000);
  
  // 載入訂單
  renderOrders();
  
  // 載入範本
  renderTemplates();
}

// 渲染訂單列表
function renderOrders() {
  const orders = JSON.parse(localStorage.getItem('smsOrders') || '[]');
  const container = document.getElementById('smsOrderList');
  
  if (!container) return;
  
  if (orders.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #6b7280;">
        <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
        <p>尚無訂單資料</p>
        <p style="font-size: 14px; margin-top: 8px;">可以手動新增或從付款模組匯入</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = orders.map(order => `
    <div class="sms-order-card ${order.status === 'picked' ? 'picked' : ''}" data-order-id="${order.id}">
      <div class="sms-order-header">
        <div class="sms-order-checkbox">
          <input type="checkbox" id="order-${order.id}" onchange="toggleOrderSelection(${order.id})">
        </div>
        <div class="sms-order-title">
          <h3>#${order.id} ${order.name}</h3>
          <div class="sms-order-phone">${order.phone}</div>
        </div>
        <div class="sms-order-badge ${order.status === 'picked' ? 'badge-picked' : 'badge-pending'}">
          ${order.status === 'picked' ? '待取貨' : '未取貨'}
        </div>
      </div>
      
      <div class="sms-order-details">
        <div class="sms-detail-row">
          <span class="sms-detail-label">平台</span>
          <span class="sms-detail-value">${order.platform || '賣貨便'}</span>
        </div>
        <div class="sms-detail-row">
          <span class="sms-detail-label">門市</span>
          <span class="sms-detail-value">${order.store || '高雄門市'}</span>
        </div>
        <div class="sms-detail-row">
          <span class="sms-detail-label">出貨日</span>
          <span class="sms-detail-value">${order.shipDate || '2026/01/14'}</span>
        </div>
        <div class="sms-detail-row">
          <span class="sms-detail-label">取貨期限</span>
          <span class="sms-detail-value">${order.deadline || '2026-01-23'}</span>
        </div>
      </div>
      
      ${order.pickupDate ? `
        <div style="margin-top: 12px; padding: 10px; background: #d1fae5; border-radius: 6px; color: #065f46; font-size: 13px; font-weight: 500;">
          ✅ 已標記取貨日：${order.pickupDate}
        </div>
      ` : ''}
      
      ${order.smsContent ? `
        <div class="sms-preview">
          <div class="sms-preview-label">📱 簡訊內容預覽：</div>
          <div class="sms-preview-content">${order.smsContent}</div>
        </div>
      ` : ''}
      
      <div class="sms-order-actions">
        <button class="btn-mark-pickup" onclick="markPickupToday(${order.id})">
          ✓ 標記今天取貨
        </button>
        <button class="btn-select-date" onclick="selectPickupDate(${order.id})">
          📅 選擇取貨日期
        </button>
        <button class="btn-delete" onclick="deleteOrder(${order.id})">
          🗑️ 刪除
        </button>
      </div>
    </div>
  `).join('');
}

// 標記今天取貨
function markPickupToday(orderId) {
  const orders = JSON.parse(localStorage.getItem('smsOrders') || '[]');
  const order = orders.find(o => o.id === orderId);
  
  if (order) {
    const today = new Date().toISOString().split('T')[0];
    order.pickupDate = today;
    order.status = 'picked';
    localStorage.setItem('smsOrders', JSON.stringify(orders));
    
    showNotification(`✅ 已標記取貨日：${today}`, 'success');
    renderOrders();
  }
}

// 選擇取貨日期
function selectPickupDate(orderId) {
  const today = new Date().toISOString().split('T')[0];
  
  // 建立對話框
  const dialog = document.createElement('div');
  dialog.id = 'pickup-date-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    z-index: 10000;
    min-width: 320px;
  `;
  
  dialog.innerHTML = `
    <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px;">📅 選擇取貨日期</h3>
    <div style="margin-bottom: 20px;">
      <input type="date" id="pickup-date-input" 
        min="${today}"
        value="${today}"
        style="width: 100%; padding: 10px; border: 2px solid #d1d5db; border-radius: 8px; font-size: 15px; box-sizing: border-box;">
    </div>
    <div style="display: flex; gap: 10px; justify-content: flex-end;">
      <button onclick="closePickupDateDialog()" 
        style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;">
        取消
      </button>
      <button onclick="confirmPickupDate(${orderId})" 
        style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;">
        確認
      </button>
    </div>
  `;
  
  // 建立遮罩
  const overlay = document.createElement('div');
  overlay.id = 'pickup-date-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 9999;
  `;
  overlay.onclick = closePickupDateDialog;
  
  document.body.appendChild(overlay);
  document.body.appendChild(dialog);
  
  // 聚焦到日期輸入框
  setTimeout(() => {
    document.getElementById('pickup-date-input').focus();
  }, 100);
}

// 確認取貨日期
function confirmPickupDate(orderId) {
  const dateInput = document.getElementById('pickup-date-input');
  const selectedDate = dateInput.value;
  
  if (!selectedDate) {
    alert('請選擇日期！');
    return;
  }
  
  // 更新訂單的取貨日期
  const orders = JSON.parse(localStorage.getItem('smsOrders') || '[]');
  const order = orders.find(o => o.id === orderId);
  
  if (order) {
    order.pickupDate = selectedDate;
    order.status = 'picked';
    localStorage.setItem('smsOrders', JSON.stringify(orders));
    
    // 顯示成功訊息
    showNotification(`✅ 已標記取貨日：${selectedDate}`, 'success');
    
    // 重新渲染
    renderOrders();
  }
  
  closePickupDateDialog();
}

// 關閉對話框
function closePickupDateDialog() {
  const dialog = document.getElementById('pickup-date-dialog');
  const overlay = document.getElementById('pickup-date-overlay');
  if (dialog) dialog.remove();
  if (overlay) overlay.remove();
}

// 顯示通知
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10001;
    font-size: 14px;
    font-weight: 500;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// 加入動畫樣式
if (!document.getElementById('notification-animations')) {
  const style = document.createElement('style');
  style.id = 'notification-animations';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// 刪除訂單
function deleteOrder(orderId) {
  if (!confirm('確定要刪除這筆訂單嗎？')) return;
  
  let orders = JSON.parse(localStorage.getItem('smsOrders') || '[]');
  orders = orders.filter(o => o.id !== orderId);
  localStorage.setItem('smsOrders', JSON.stringify(orders));
  
  showNotification('✅ 訂單已刪除', 'success');
  renderOrders();
}

// 切換訂單選擇
function toggleOrderSelection(orderId) {
  // 這個功能可以用於批量操作
  console.log('訂單選擇切換:', orderId);
}

// 渲染範本列表
function renderTemplates() {
  const templates = JSON.parse(localStorage.getItem('smsTemplates') || '[]');
  const container = document.getElementById('smsTemplateList');
  
  if (!container) return;
  
  if (templates.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #6b7280;">
        <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
        <p>尚無簡訊範本</p>
        <p style="font-size: 14px; margin-top: 8px;">點擊上方按鈕新增範本</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = templates.map(template => `
    <div class="sms-template-card">
      <div class="sms-template-header">
        <h3>${template.name}</h3>
        <button class="btn-delete-small" onclick="deleteTemplate(${template.id})">🗑️</button>
      </div>
      <div class="sms-template-content">${template.content}</div>
      <div class="sms-template-actions">
        <button class="btn-apply" onclick="applyTemplate(${template.id})">套用到選中訂單</button>
      </div>
    </div>
  `).join('');
}

// 新增訂單（示例）
function addNewOrder() {
  const name = prompt('請輸入客戶姓名：');
  if (!name) return;
  
  const phone = prompt('請輸入手機號碼：');
  if (!phone) return;
  
  const orders = JSON.parse(localStorage.getItem('smsOrders') || '[]');
  const newOrder = {
    id: Date.now(),
    name: name,
    phone: phone,
    platform: '賣貨便',
    store: '高雄門市',
    shipDate: new Date().toISOString().split('T')[0],
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'pending'
  };
  
  orders.push(newOrder);
  localStorage.setItem('smsOrders', JSON.stringify(orders));
  
  showNotification('✅ 訂單新增成功', 'success');
  renderOrders();
}

// 新增範本
function addNewTemplate() {
  const name = prompt('請輸入範本名稱：');
  if (!name) return;
  
  const content = prompt('請輸入簡訊內容：\n(可使用 {name}, {phone}, {store} 等變數)');
  if (!content) return;
  
  const templates = JSON.parse(localStorage.getItem('smsTemplates') || '[]');
  const newTemplate = {
    id: Date.now(),
    name: name,
    content: content
  };
  
  templates.push(newTemplate);
  localStorage.setItem('smsTemplates', JSON.stringify(templates));
  
  showNotification('✅ 範本新增成功', 'success');
  renderTemplates();
}

// 刪除範本
function deleteTemplate(templateId) {
  if (!confirm('確定要刪除這個範本嗎？')) return;
  
  let templates = JSON.parse(localStorage.getItem('smsTemplates') || '[]');
  templates = templates.filter(t => t.id !== templateId);
  localStorage.setItem('smsTemplates', JSON.stringify(templates));
  
  showNotification('✅ 範本已刪除', 'success');
  renderTemplates();
}

// 套用範本
function applyTemplate(templateId) {
  const templates = JSON.parse(localStorage.getItem('smsTemplates') || '[]');
  const template = templates.find(t => t.id === templateId);
  
  if (!template) return;
  
  // 獲取選中的訂單
  const orders = JSON.parse(localStorage.getItem('smsOrders') || '[]');
  const checkboxes = document.querySelectorAll('#smsOrderList input[type="checkbox"]:checked');
  
  if (checkboxes.length === 0) {
    alert('請先選擇要套用範本的訂單！');
    return;
  }
  
  let count = 0;
  checkboxes.forEach(checkbox => {
    const orderId = parseInt(checkbox.id.replace('order-', ''));
    const order = orders.find(o => o.id === orderId);
    
    if (order) {
      // 替換變數
      let content = template.content;
      content = content.replace(/{name}/g, order.name);
      content = content.replace(/{phone}/g, order.phone);
      content = content.replace(/{store}/g, order.store || '高雄門市');
      content = content.replace(/{shipDate}/g, order.shipDate || '');
      content = content.replace(/{deadline}/g, order.deadline || '');
      
      order.smsContent = content;
      count++;
    }
  });
  
  localStorage.setItem('smsOrders', JSON.stringify(orders));
  
  showNotification(`✅ 已套用範本到 ${count} 筆訂單`, 'success');
  renderOrders();
}

// 批量發送簡訊（模擬）
function sendBulkSMS() {
  const checkboxes = document.querySelectorAll('#smsOrderList input[type="checkbox"]:checked');
  
  if (checkboxes.length === 0) {
    alert('請先選擇要發送簡訊的訂單！');
    return;
  }
  
  if (!confirm(`確定要發送 ${checkboxes.length} 則簡訊嗎？`)) return;
  
  // 模擬發送
  showNotification(`📱 正在發送 ${checkboxes.length} 則簡訊...`, 'info');
  
  setTimeout(() => {
    showNotification(`✅ 已成功發送 ${checkboxes.length} 則簡訊`, 'success');
  }, 1500);
}

console.log('SMS 模組載入完成');
