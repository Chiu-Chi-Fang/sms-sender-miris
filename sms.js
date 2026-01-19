/* ========================= SMS Module ========================= */

const SMS_STORAGE_KEY = 'sms_orders_v2';
const SMS_TEMPLATES_KEY = 'sms_templates_v2';

let smsCurrentEditId = null;

// ===== Storage =====
function sms_getOrders() {
  try {
    return JSON.parse(localStorage.getItem(SMS_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function sms_saveOrders(orders) {
  localStorage.setItem(SMS_STORAGE_KEY, JSON.stringify(orders));
  sms_updateSyncStatus();
}

function sms_getTemplates() {
  try {
    const stored = localStorage.getItem(SMS_TEMPLATES_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return sms_getDefaultTemplates();
}

function sms_saveTemplates(templates) {
  localStorage.setItem(SMS_TEMPLATES_KEY, JSON.stringify(templates));
}

function sms_getDefaultTemplates() {
  return [
    {
      id: 1,
      name: '取貨通知',
      content: '親愛的{customerName}您好，您的訂單{orderNumber}已送達{storeType}{storeName}，請於{pickupDeadline}前取貨。'
    },
    {
      id: 2,
      name: '取貨提醒',
      content: '{customerName}您好，提醒您訂單{orderNumber}將於{pickupDeadline}到期，請盡快至{storeType}{storeName}取貨。'
    },
    {
      id: 3,
      name: '感謝購買',
      content: '{customerName}您好，感謝您的購買！您的訂單{orderNumber}已完成，期待下次再為您服務。'
    }
  ];
}

// ===== Tab Switch =====
function sms_switchTab(evt, tabName) {
  const parent = document.getElementById('main-sms');
  parent.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  parent.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));
  evt.target.classList.add('active');
  document.getElementById('sms' + tabName.charAt(0).toUpperCase() + tabName.slice(1) + 'Tab').classList.add('active');

  if (tabName === 'orders') sms_renderOrders();
  if (tabName === 'templates') sms_renderTemplates();
  if (tabName === 'send') sms_renderSendTab();
}

// ===== Modal =====
function sms_showAddOrderModal() {
  document.getElementById('smsAddOrderModal').classList.add('active');
  document.getElementById('smsOrderPhone').value = '';
  document.getElementById('smsOrderName').value = '';
  document.getElementById('smsOrderNumber').value = '';
  document.getElementById('smsOrderStoreType').value = '全家';
  document.getElementById('smsOrderStoreName').value = '';
  document.getElementById('smsOrderDeadline').value = '';
}

function sms_showBulkImportModal() {
  document.getElementById('smsBulkImportModal').classList.add('active');
  document.getElementById('smsBulkImportData').value = '';
}

function sms_showAddTemplateModal() {
  document.getElementById('smsAddTemplateModal').classList.add('active');
  document.getElementById('smsTemplateName').value = '';
  document.getElementById('smsTemplateContent').value = '';
}

function sms_closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// ===== Add Order =====
function sms_addOrder() {
  const phone = document.getElementById('smsOrderPhone').value.trim();
  const name = document.getElementById('smsOrderName').value.trim();
  const orderNumber = document.getElementById('smsOrderNumber').value.trim();
  const storeType = document.getElementById('smsOrderStoreType').value;
  const storeName = document.getElementById('smsOrderStoreName').value.trim();
  const deadline = document.getElementById('smsOrderDeadline').value;

  if (!phone) return alert('請輸入手機號碼');
  if (!name) return alert('請輸入客戶姓名');

  const orders = sms_getOrders();
  orders.push({
    id: Date.now() + Math.random(),
    phone,
    customerName: name,
    orderNumber: orderNumber || '-',
    storeType,
    storeName: storeName || '-',
    pickupDeadline: deadline || '-',
    smsContent: '',
    status: 'draft',
    sendHistory: []
  });

  sms_saveOrders(orders);
  sms_closeModal('smsAddOrderModal');
  sms_renderOrders();
  alert('✅ 訂單新增成功！');
}

// ===== Bulk Import =====
function sms_bulkImport() {
  const data = document.getElementById('smsBulkImportData').value.trim();
  if (!data) return alert('請貼上資料');

  const lines = data.split('\n').filter(l => l.trim());
  const orders = sms_getOrders();
  let success = 0;

  lines.forEach(line => {
    const parts = line.split(/[\t,]/).map(p => p.trim());
    if (parts.length < 2) return;

    const [phone, name, orderNumber, storeType, storeName, deadline] = parts;
    if (!phone || !name) return;

    orders.push({
      id: Date.now() + Math.random(),
      phone,
      customerName: name,
      orderNumber: orderNumber || '-',
      storeType: storeType || '全家',
      storeName: storeName || '-',
      pickupDeadline: deadline || '-',
      smsContent: '',
      status: 'draft',
      sendHistory: []
    });
    success++;
  });

  sms_saveOrders(orders);
  sms_closeModal('smsBulkImportModal');
  sms_renderOrders();
  alert(`✅ 成功匯入 ${success} 筆訂單！`);
}

// ===== Delete Order =====
function sms_deleteOrder(id) {
  if (!confirm('確定要刪除此訂單嗎？')) return;
  let orders = sms_getOrders();
  orders = orders.filter(o => o.id !== id);
  sms_saveOrders(orders);
  sms_renderOrders();
}

// ===== Clear All =====
function sms_clearAllOrders() {
  if (!confirm('⚠️ 確定要清空所有訂單嗎？此操作無法復原！')) return;
  localStorage.removeItem(SMS_STORAGE_KEY);
  sms_renderOrders();
  alert('✅ 已清空所有訂單');
}

// ===== Export Orders =====
function sms_exportOrders() {
  const orders = sms_getOrders();
  if (orders.length === 0) return alert('沒有訂單可以匯出');

  const data = orders.map(o => ({
    '手機號碼': o.phone,
    '客戶姓名': o.customerName,
    '訂單號碼': o.orderNumber,
    '門市類別': o.storeType,
    '門市名稱': o.storeName,
    '取貨期限': o.pickupDeadline,
    '簡訊內容': o.smsContent,
    '狀態': o.status === 'sent' ? '已發送' : '草稿'
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'SMS訂單');
  XLSX.writeFile(wb, `SMS訂單_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ===== Render Orders =====
function sms_renderOrders() {
  const orders = sms_getOrders();
  const container = document.getElementById('smsOrdersList');

  if (orders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">尚無訂單資料</div>
        <div class="empty-text">點擊「新增訂單」或「批量匯入」開始使用</div>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="order-header">
        <div class="order-title">
          <div>
            <div class="order-name">${o.customerName} (${o.phone})</div>
            <div style="font-size: 13px; color: var(--gray-600); margin-top: 2px;">訂單：${o.orderNumber}</div>
          </div>
        </div>
        <span class="badge ${o.status === 'sent' ? 'badge-picked' : 'badge-draft'}">
          ${o.status === 'sent' ? '已發送' : '草稿'}
        </span>
      </div>

      <div class="order-grid">
        <div>
          <div class="order-field-label">門市</div>
          <div class="order-field-value">${o.storeType} ${o.storeName}</div>
        </div>
        <div>
          <div class="order-field-label">取貨期限</div>
          <div class="order-field-value">${o.pickupDeadline}</div>
        </div>
      </div>

      ${o.smsContent ? `
        <div class="sms-preview">
          <div class="sms-preview-label">簡訊內容</div>
          <div class="sms-preview-content">${o.smsContent}</div>
        </div>
      ` : ''}

      ${o.sendHistory && o.sendHistory.length > 0 ? `
        <div class="send-history">
          <div class="send-history-header">📤 發送記錄</div>
          <div class="send-history-summary">
            <span>總發送次數：${o.sendHistory.length}</span>
            <span>最後發送：${o.sendHistory[o.sendHistory.length - 1].timestamp}</span>
          </div>
          <div class="send-history-list">
            ${o.sendHistory.slice(-3).reverse().map(h => `
              <div class="history-item">🕐 ${h.timestamp} - ${h.content.substring(0, 30)}...</div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="order-actions">
        <button class="btn btn-danger btn-sm" onclick="sms_deleteOrder(${o.id})">
          <span>🗑️</span> 刪除
        </button>
      </div>
    </div>
  `).join('');
}

// ===== Templates =====
function sms_addTemplate() {
  const name = document.getElementById('smsTemplateName').value.trim();
  const content = document.getElementById('smsTemplateContent').value.trim();

  if (!name) return alert('請輸入範本名稱');
  if (!content) return alert('請輸入範本內容');

  const templates = sms_getTemplates();
  const maxId = templates.length > 0 ? Math.max(...templates.map(t => t.id)) : 0;

  templates.push({
    id: maxId + 1,
    name,
    content
  });

  sms_saveTemplates(templates);
  sms_closeModal('smsAddTemplateModal');
  sms_renderTemplates();
  alert('✅ 範本新增成功！');
}

function sms_deleteTemplate(id) {
  if (!confirm('確定要刪除此範本嗎？')) return;
  let templates = sms_getTemplates();
  templates = templates.filter(t => t.id !== id);
  sms_saveTemplates(templates);
  sms_renderTemplates();
}

function sms_exportTemplates() {
  const templates = sms_getTemplates();
  const data = templates.map(t => ({
    '範本名稱': t.name,
    '範本內容': t.content
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '簡訊範本');
  XLSX.writeFile(wb, `簡訊範本_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function sms_importTemplates() {
  alert('請使用「新增範本」功能手動建立範本');
}

function sms_resetTemplates() {
  if (!confirm('⚠️ 確定要重置為預設範本嗎？目前的自訂範本將會被清除！')) return;
  localStorage.removeItem(SMS_TEMPLATES_KEY);
  sms_renderTemplates();
  alert('✅ 已重置為預設範本');
}

function sms_renderTemplates() {
  const templates = sms_getTemplates();
  const container = document.getElementById('smsTemplatesList');

  if (templates.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <div class="empty-title">尚無範本</div>
        <div class="empty-text">點擊「新增範本」開始建立</div>
      </div>
    `;
    return;
  }

  container.innerHTML = templates.map(t => `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
        <h3 style="font-size: 18px; color: var(--gray-900); margin: 0;">${t.name}</h3>
        <button class="btn btn-danger btn-sm" onclick="sms_deleteTemplate(${t.id})">
          <span>🗑️</span> 刪除
        </button>
      </div>
      <div class="sms-preview">
        <div class="sms-preview-content">${t.content}</div>
      </div>
    </div>
  `).join('');
}

// ===== Send Tab =====
function sms_renderSendTab() {
  const orders = sms_getOrders();
  const templates = sms_getTemplates();
  const container = document.getElementById('smsSendOrdersList');

  // Update template select
  const select = document.getElementById('smsTemplateSelect');
  select.innerHTML = '<option value="">-- 請選擇範本 --</option>' +
    templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  if (orders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📤</div>
        <div class="empty-title">尚無訂單</div>
        <div class="empty-text">請先在「訂單管理」中新增訂單</div>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(o => `
    <div class="order-card ${o.selected ? 'selected' : ''}">
      <div class="order-header">
        <div class="order-title">
          <input type="checkbox" class="sms-order-checkbox" data-id="${o.id}" ${o.selected ? 'checked' : ''} onchange="sms_toggleOrderSelect(${o.id})">
          <div>
            <div class="order-name">${o.customerName} (${o.phone})</div>
            <div style="font-size: 13px; color: var(--gray-600); margin-top: 2px;">訂單：${o.orderNumber}</div>
          </div>
        </div>
        <span class="badge ${o.status === 'sent' ? 'badge-picked' : 'badge-draft'}">
          ${o.status === 'sent' ? '已發送' : '草稿'}
        </span>
      </div>

      <div class="order-grid">
        <div>
          <div class="order-field-label">門市</div>
          <div class="order-field-value">${o.storeType} ${o.storeName}</div>
        </div>
        <div>
          <div class="order-field-label">取貨期限</div>
          <div class="order-field-value">${o.pickupDeadline}</div>
        </div>
      </div>

      ${o.smsContent ? `
        <div class="sms-preview">
          <div class="sms-preview-label">簡訊內容預覽</div>
          <div class="sms-preview-content">${o.smsContent}</div>
        </div>
      ` : ''}

      <div class="order-actions">
        <button class="btn btn-primary btn-sm" onclick="sms_editSms(${o.id})">
          <span>✏️</span> 編輯簡訊
        </button>
        ${o.smsContent ? `
          <button class="btn btn-success btn-sm" onclick="sms_sendSingle(${o.id})">
            <span>📤</span> 發送
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function sms_toggleOrderSelect(id) {
  const orders = sms_getOrders();
  const order = orders.find(o => o.id === id);
  if (order) {
    order.selected = !order.selected;
    sms_saveOrders(orders);
    sms_renderSendTab();
  }
}

function sms_toggleSelectAll() {
  const checked = document.getElementById('smsSelectAllOrders').checked;
  const orders = sms_getOrders();
  orders.forEach(o => o.selected = checked);
  sms_saveOrders(orders);
  sms_renderSendTab();
}

function sms_previewTemplate() {
  const templateId = parseInt(document.getElementById('smsTemplateSelect').value);
  if (!templateId) {
    document.getElementById('smsTemplatePreview').value = '';
    return;
  }

  const templates = sms_getTemplates();
  const template = templates.find(t => t.id === templateId);
  if (template) {
    document.getElementById('smsTemplatePreview').value = template.content;
  }
}

function sms_applyTemplateToSelected() {
  const content = document.getElementById('smsTemplatePreview').value.trim();
  if (!content) return alert('請先選擇或編輯範本內容');

  const orders = sms_getOrders();
  const selected = orders.filter(o => o.selected);

  if (selected.length === 0) return alert('請先勾選要套用的客戶');

  selected.forEach(o => {
    o.smsContent = content
      .replace(/{customerName}/g, o.customerName)
      .replace(/{orderNumber}/g, o.orderNumber)
      .replace(/{storeType}/g, o.storeType)
      .replace(/{storeName}/g, o.storeName)
      .replace(/{pickupDeadline}/g, o.pickupDeadline);
  });

  sms_saveOrders(orders);
  sms_renderSendTab();
  alert(`✅ 已套用範本到 ${selected.length} 位客戶！`);
}

function sms_saveDrafts() {
  alert('✅ 草稿已自動儲存！');
}

function sms_editSms(id) {
  const orders = sms_getOrders();
  const order = orders.find(o => o.id === id);
  if (!order) return;

  smsCurrentEditId = id;
  document.getElementById('smsEditSmsCustomer').textContent = `${order.customerName} (${order.phone})`;
  document.getElementById('smsEditSmsContent').value = order.smsContent || '';
  document.getElementById('smsEditSmsModal').classList.add('active');
}

function sms_saveEditedSms() {
  if (!smsCurrentEditId) return;

  const content = document.getElementById('smsEditSmsContent').value.trim();
  const orders = sms_getOrders();
  const order = orders.find(o => o.id === smsCurrentEditId);

  if (order) {
    order.smsContent = content;
    sms_saveOrders(orders);
  }

  sms_closeModal('smsEditSmsModal');
  sms_renderSendTab();
  alert('✅ 簡訊內容已儲存！');
}

function sms_sendSingle(id) {
  const orders = sms_getOrders();
  const order = orders.find(o => o.id === id);
  if (!order || !order.smsContent) return alert('請先編輯簡訊內容');

  if (!confirm(`確定要發送簡訊給 ${order.customerName} (${order.phone}) 嗎？`)) return;

  if (!order.sendHistory) order.sendHistory = [];
  order.sendHistory.push({
    timestamp: new Date().toLocaleString('zh-TW'),
    content: order.smsContent
  });
  order.status = 'sent';

  sms_saveOrders(orders);
  sms_renderSendTab();
  alert('✅ 簡訊已發送！（模擬）');
}

function sms_startSending() {
  const orders = sms_getOrders();
  const toSend = orders.filter(o => o.selected && o.smsContent);

  if (toSend.length === 0) return alert('沒有可發送的簡訊（請確認已勾選且有簡訊內容）');

  if (!confirm(`確定要發送 ${toSend.length} 則簡訊嗎？`)) return;

  toSend.forEach(o => {
    if (!o.sendHistory) o.sendHistory = [];
    o.sendHistory.push({
      timestamp: new Date().toLocaleString('zh-TW'),
      content: o.smsContent
    });
    o.status = 'sent';
    o.selected = false;
  });

  sms_saveOrders(orders);
  sms_renderSendTab();
  alert(`✅ 已成功發送 ${toSend.length} 則簡訊！（模擬）`);
}

// ===== Sync Status =====
function sms_updateSyncStatus() {
  const indicator = document.getElementById('smsSyncIndicator');
  const status = document.getElementById('smsSyncStatus');
  if (indicator && status) {
    indicator.classList.remove('offline');
    status.textContent = '已同步';
    setTimeout(() => {
      status.textContent = '雲端同步中...';
    }, 2000);
  }
}

// ===== Import from Pay Module =====
window.sms_importFromPay = function(payOrders) {
  const smsOrders = sms_getOrders();
  let imported = 0;

  payOrders.forEach(po => {
    const exists = smsOrders.find(so => so.phone === po.phone && so.orderNumber === po.orderNumber);
    if (exists) return;

    const [storeType, ...storeNameParts] = (po.store || '').split(' ');
    smsOrders.push({
      id: Date.now() + Math.random(),
      phone: po.phone,
      customerName: po.customerName,
      orderNumber: po.orderNumber,
      storeType: storeType || '全家',
      storeName: storeNameParts.join(' ') || '-',
      pickupDeadline: po.pickupDeadline || '-',
      smsContent: '',
      status: 'draft',
      sendHistory: []
    });
    imported++;
  });

  sms_saveOrders(smsOrders);
  sms_renderOrders();
  return imported;
};

// ===== Remove orders by order numbers (called from Pay module) =====
window.sms_removeOrdersByOrderNumbers = function(orderNumbers) {
  let orders = sms_getOrders();
  const before = orders.length;
  orders = orders.filter(o => !orderNumbers.includes(o.orderNumber));
  const removed = before - orders.length;
  if (removed > 0) {
    sms_saveOrders(orders);
    console.log(`SMS模組：已移除 ${removed} 筆已取貨訂單`);
  }
};

// ===== Init =====
window.addEventListener('DOMContentLoaded', () => {
  sms_renderOrders();
  sms_renderTemplates();
  sms_updateSyncStatus();
});

