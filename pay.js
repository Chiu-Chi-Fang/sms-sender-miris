/* ========================= Main Switch ========================= */
function mainSwitch(which) {
  document.querySelectorAll('.container > .tabs .tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.container > .tab-content').forEach(p => p.classList.remove('active'));

  if (which === 'pay') {
    document.querySelectorAll('.container > .tabs .tab')[0].classList.add('active');
    document.getElementById('main-pay').classList.add('active');
    document.getElementById('smsResetBtn').style.display = 'none';
  } else {
    document.querySelectorAll('.container > .tabs .tab')[1].classList.add('active');
    document.getElementById('main-sms').classList.add('active');
    document.getElementById('smsResetBtn').style.display = 'block';
  }
}

/* ========================= Pay Logic ========================= */
function pay_switchTab(evt, tabName) {
  const parent = evt.target.closest('.tab-content') || document.getElementById('main-pay');
  parent.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  parent.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));
  evt.target.classList.add('active');
  document.getElementById('pay-' + tabName).classList.add('active');
  if (tabName === 'orders') pay_loadOrders();
}

function pay_pad2(n){ return String(n).padStart(2,'0'); }
function pay_formatDate(d){ return `${d.getFullYear()}/${pay_pad2(d.getMonth()+1)}/${pay_pad2(d.getDate())}`; }
function pay_formatDateInput(d){ return `${d.getFullYear()}-${pay_pad2(d.getMonth()+1)}-${pay_pad2(d.getDate())}`; }
function pay_weekday(d){ return ['週日','週一','週二','週三','週四','週五','週六'][d.getDay()]; }
function pay_addDays(date, days){ const d=new Date(date); d.setDate(d.getDate()+days); return d; }
function pay_nextWeekday(date, targetDay){
  const d=new Date(date);
  const cur=d.getDay();
  let add=targetDay-cur;
  if(add<=0) add+=7;
  d.setDate(d.getDate()+add);
  return d;
}

function pay_normalizeOrderNumber(raw){
  const s = String(raw || '').trim();
  if(!s) return '';
  return s.startsWith('#') ? s : ('#' + s);
}
function pay_normalizePhone(p){ return String(p || '').trim().replace(/\s+/g,''); }

function pay_parseExcelDate(value){
  if(value instanceof Date) return value;
  if(typeof value === 'number' && isFinite(value)){
    const excelEpoch = new Date(1899,11,30);
    return new Date(excelEpoch.getTime() + value*86400000);
  }
  if(typeof value === 'string'){
    const s=value.trim();
    if(!s) return null;
    const m=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if(m){
      const d=new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
      return isNaN(d.getTime())?null:d;
    }
    const d2=new Date(s);
    return isNaN(d2.getTime())?null:d2;
  }
  return null;
}

function pay_calculatePayment(platform, pickupDate){
  const dow = pickupDate.getDay();
  let settlement, payment;
  if(platform === '賣貨便'){
    if(dow >= 1 && dow <= 3){
      settlement = pay_nextWeekday(pickupDate, 4);
      payment = pay_addDays(settlement, 4);
    } else {
      settlement = pay_nextWeekday(pickupDate, 1);
      payment = pay_addDays(settlement, 2);
    }
  } else if(platform === '好賣+'){
    if(dow >= 1 && dow <= 3){
      settlement = pay_nextWeekday(pickupDate, 5);
      payment = pay_addDays(settlement, 4);
    } else {
      settlement = pay_nextWeekday(pickupDate, 3);
      payment = pay_addDays(settlement, 1);
    }
  }
  return { settlement, payment };
}

function pay_calculateDate(){
  const platform = document.getElementById('payPlatform').value;
  const pickupStr = document.getElementById('payPickupDate').value;
  if(!pickupStr) return alert('請選擇取貨日期');
  const pickup = new Date(pickupStr);
  if(isNaN(pickup.getTime())) return alert('取貨日期格式錯誤');

  const r = pay_calculatePayment(platform, pickup);
  if(!r.settlement || !r.payment) return alert('平台設定異常，無法計算');

  document.getElementById('payResultPickup').textContent = `${pay_formatDate(pickup)} (${pay_weekday(pickup)})`;
  document.getElementById('payResultSettlement').textContent = `${pay_formatDate(r.settlement)} (${pay_weekday(r.settlement)})`;
  document.getElementById('payResultPayment').textContent = `${pay_formatDate(r.payment)} (${pay_weekday(r.payment)})`;
  document.getElementById('payResult').style.display = 'block';
}

function pay_getOrders(){
  try { return JSON.parse(localStorage.getItem('pay_orders_final') || '[]'); }
  catch { return []; }
}
function pay_saveOrders(orders){
  localStorage.setItem('pay_orders_final', JSON.stringify(orders));
}

function pay_addOrder(){
  const orderNumber = pay_normalizeOrderNumber(document.getElementById('payOrderNumber').value);
  const customerName = document.getElementById('payCustomerName').value.trim();
  const phone = pay_normalizePhone(document.getElementById('payPhone').value);
  const platform = document.getElementById('payOrderPlatform').value;
  const store = document.getElementById('payStore').value.trim();
  const shipStr = document.getElementById('payOrderShipDate').value;
  const deadlineStr = document.getElementById('payPickupDeadline').value;

  if(!orderNumber) return alert('請輸入訂單號');
  if(!customerName) return alert('請輸入姓名');
  if(!phone) return alert('請輸入電話');
  if(!shipStr) return alert('請選擇出貨日');

  const ship = new Date(shipStr);
  if(isNaN(ship.getTime())) return alert('出貨日格式錯誤');

  let pickupDeadline = '';
  if (deadlineStr) {
    const d = new Date(deadlineStr);
    if (!isNaN(d.getTime())) pickupDeadline = pay_formatDateInput(d);
  }

  const orders = pay_getOrders();
  orders.push({
    id: Date.now() + Math.random(),
    orderNumber,
    customerName,
    phone,
    platform,
    store,
    shipDate: pay_formatDate(ship),
    pickupDeadline,
    pickupDate: '-',
    settlementDate: '-',
    paymentDate: '-',
    status: '待取貨'
  });
  pay_saveOrders(orders);

  document.getElementById('payOrderNumber').value = '';
  document.getElementById('payCustomerName').value = '';
  document.getElementById('payPhone').value = '';
  document.getElementById('payStore').value = '';
  document.getElementById('payOrderShipDate').value = '';
  document.getElementById('payPickupDeadline').value = '';

  pay_loadOrders();
  alert('✅ 訂單新增成功！');
}

function pay_deleteOrder(id){
  if(!confirm('確定要刪除此訂單嗎？')) return;
  let orders = pay_getOrders();
  orders = orders.filter(o => o.id !== id);
  pay_saveOrders(orders);
  pay_loadOrders();
}

function pay_syncDeleteSMS(orderNumbers){
  if (window.sms_removeOrdersByOrderNumbers && Array.isArray(orderNumbers) && orderNumbers.length > 0) {
    window.sms_removeOrdersByOrderNumbers(orderNumbers.map(pay_normalizeOrderNumber));
  }
}

function pay_pickupToday(id){
  const today = new Date();
  const orders = pay_getOrders();
  const o = orders.find(x => x.id === id);
  if(!o) return;

  const r = pay_calculatePayment(o.platform, today);
  o.pickupDate = pay_formatDate(today);
  o.settlementDate = pay_formatDate(r.settlement);
  o.paymentDate = pay_formatDate(r.payment);
  o.status = '已取貨';

  pay_saveOrders(orders);
  pay_loadOrders();

  pay_syncDeleteSMS([o.orderNumber]);
}

function pay_toggleSelectAll(){
  const all = document.getElementById('paySelectAll').checked;
  document.querySelectorAll('.pay-order-checkbox').forEach(cb => cb.checked = all);
}
function pay_selectedIds(){
  return Array.from(document.querySelectorAll('.pay-order-checkbox:checked'))
    .map(cb => Number(cb.getAttribute('data-id')))
    .filter(n => !Number.isNaN(n));
}

function pay_batchPickupToday(){
  const ids = pay_selectedIds();
  if(ids.length === 0) return alert('請先勾選要取貨的訂單');
  if(!confirm(`確定要將 ${ids.length} 筆訂單取貨日設為今天嗎？`)) return;

  const today = new Date();
  const orders = pay_getOrders();
  const pickedOrderNumbers = [];

  orders.forEach(o => {
    if(!ids.includes(o.id)) return;
    if(o.status !== '待取貨') return;
    const r = pay_calculatePayment(o.platform, today);
    o.pickupDate = pay_formatDate(today);
    o.settlementDate = pay_formatDate(r.settlement);
    o.paymentDate = pay_formatDate(r.payment);
    o.status = '已取貨';
    pickedOrderNumbers.push(o.orderNumber);
  });

  pay_saveOrders(orders);
  pay_loadOrders();

  pay_syncDeleteSMS(pickedOrderNumbers);
  alert(`✅ 已標記 ${pickedOrderNumbers.length} 筆訂單為已取貨！`);
}

function pay_batchDelete(){
  const ids = pay_selectedIds();
  if(ids.length === 0) return alert('請先勾選要刪除的訂單');
  if(!confirm(`確定要刪除 ${ids.length} 筆訂單嗎？此操作無法復原！`)) return;

  let orders = pay_getOrders();
  orders = orders.filter(o => !ids.includes(o.id));
  pay_saveOrders(orders);
  pay_loadOrders();
  alert('✅ 刪除成功！');
}

function pay_loadOrders(){
  const orders = pay_getOrders();
  const container = document.getElementById('payOrdersList');
  
  if(orders.length === 0){
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-title">尚無訂單資料</div>
        <div class="empty-text">點擊上方「新增訂單」或使用「批量匯入」功能</div>
      </div>
    `;
    document.getElementById('payTotalOrders').textContent = '0';
    document.getElementById('payPendingOrders').textContent = '0';
    document.getElementById('payPickedOrders').textContent = '0';
    return;
  }

  let pending = 0, picked = 0;
  orders.forEach(o => {
    if(o.status === '待取貨') pending++;
    if(o.status === '已取貨') picked++;
  });

  container.innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="order-header">
        <div class="order-title">
          <input type="checkbox" class="pay-order-checkbox" data-id="${o.id}">
          <div>
            <div class="order-name">${o.orderNumber} ${o.customerName}</div>
            <div style="font-size: 13px; color: var(--gray-600); margin-top: 2px;">${o.phone}</div>
          </div>
        </div>
        <span class="badge ${o.status === '待取貨' ? 'badge-pending' : 'badge-picked'}">${o.status}</span>
      </div>

      <div class="order-grid">
        <div>
          <div class="order-field-label">平台</div>
          <div class="order-field-value">${o.platform}</div>
        </div>
        <div>
          <div class="order-field-label">門市</div>
          <div class="order-field-value">${o.store || '-'}</div>
        </div>
        <div>
          <div class="order-field-label">出貨日</div>
          <div class="order-field-value">${o.shipDate}</div>
        </div>
        <div>
          <div class="order-field-label">取貨期限</div>
          <div class="order-field-value">${o.pickupDeadline || '-'}</div>
        </div>
        ${o.status === '已取貨' ? `
        <div>
          <div class="order-field-label">取貨日</div>
          <div class="order-field-value">${o.pickupDate}</div>
        </div>
        <div>
          <div class="order-field-label">結算日</div>
          <div class="order-field-value">${o.settlementDate}</div>
        </div>
        <div>
          <div class="order-field-label">匯款日</div>
          <div class="order-field-value">${o.paymentDate}</div>
        </div>
        ` : ''}
      </div>

      <div class="order-actions">
        ${o.status === '待取貨' ? `
          <button class="btn btn-success btn-sm" onclick="pay_pickupToday(${o.id})">
            <span>✅</span> 標記今天取貨
          </button>
        ` : ''}
        <button class="btn btn-danger btn-sm" onclick="pay_deleteOrder(${o.id})">
          <span>🗑️</span> 刪除
        </button>
      </div>
    </div>
  `).join('');

  document.getElementById('payTotalOrders').textContent = orders.length;
  document.getElementById('payPendingOrders').textContent = pending;
  document.getElementById('payPickedOrders').textContent = picked;
  const selectAll = document.getElementById('paySelectAll');
  if(selectAll) selectAll.checked = false;
}

function pay_exportToExcel(){
  const orders = pay_getOrders();
  if(orders.length === 0) return alert('沒有訂單可以匯出');

  const data = orders.map(o => ({
    '訂單號': o.orderNumber,
    '姓名': o.customerName,
    '電話': o.phone,
    '平台': o.platform,
    '門市': o.store,
    '出貨日': o.shipDate,
    '取貨期限': o.pickupDeadline,
    '取貨日': o.pickupDate,
    '結算日': o.settlementDate,
    '匯款日': o.paymentDate,
    '狀態': o.status
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '訂單列表');
  XLSX.writeFile(wb, `整合訂單_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function pay_trimHeaderRow(row){
  const out = {};
  Object.keys(row || {}).forEach(k => out[String(k).trim()] = row[k]);
  return out;
}
function pay_findField(obj, keys){
  for (const k of keys){ if (obj[k] !== undefined) return obj[k]; }
  return undefined;
}

function pay_handleFileUpload(event){
  const file = event.target.files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = function(e){
    try{
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type:'array', cellDates:true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { raw:true });

      let orders = pay_getOrders();
      let success = 0, fail = 0;

      rows.forEach(row => {
        const r = pay_trimHeaderRow(row);

        const orderNumberRaw = pay_findField(r, ['訂單號','訂單編號','订单号','订单编号','訂單']);
        const customerName = pay_findField(r, ['姓名','客戶姓名','客户姓名','收件人','客戶','客户']);
        const phoneRaw = pay_findField(r, ['電話','手機','手機號碼','手机号','電話號碼','手机号码','phone']);
        const platform = pay_findField(r, ['平台']);
        const store = pay_findField(r, ['門市','取貨門市','门市','取件门市','店','門市名稱','门店']);
        const shipRaw = pay_findField(r, ['出貨日','出貨日期','出货日','出货日期','出貨']);
        const deadlineRaw = pay_findField(r, ['取貨期限','取貨到期日','取件期限','取件到期日','取货期限','取货到期日','pickupDeadline']);

        if(!orderNumberRaw || !customerName || !phoneRaw || !platform || !shipRaw){ fail++; return; }

        const ship = pay_parseExcelDate(shipRaw);
        if(!ship || isNaN(ship.getTime())){ fail++; return; }

        let pickupDeadline = '';
        if (deadlineRaw !== undefined && deadlineRaw !== null && String(deadlineRaw).trim() !== '') {
          const dd = pay_parseExcelDate(deadlineRaw);
          if (dd && !isNaN(dd.getTime())) pickupDeadline = pay_formatDateInput(dd);
        }

        orders.push({
          id: Date.now() + Math.random(),
          orderNumber: pay_normalizeOrderNumber(orderNumberRaw),
          customerName: String(customerName).trim(),
          phone: pay_normalizePhone(phoneRaw),
          platform: String(platform).trim(),
          store: store ? String(store).trim() : '',
          shipDate: pay_formatDate(ship),
          pickupDeadline,
          pickupDate: '-',
          settlementDate: '-',
          paymentDate: '-',
          status: '待取貨'
        });
        success++;
      });

      pay_saveOrders(orders);
      pay_loadOrders();
      alert(`✅ 匯入完成！\n成功：${success} 筆\n失敗：${fail} 筆`);
    } catch(err) {
      alert('❌ 檔案讀取失敗：' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function pay_downloadTemplate(){
  const template = [
    { '訂單號': '#1468', '姓名': '王小明', '電話': '0912345678', '平台': '賣貨便', '門市': '全家 台北車站店', '出貨日': '2026/01/15', '取貨期限': '2026/01/22' }
  ];
  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '訂單範本');
  XLSX.writeFile(wb, '訂單匯入範本.xlsx');
}

function pay_pushSelectedToSMS(){
  const ids = pay_selectedIds();
  if(ids.length === 0) return alert('請先勾選要帶入 SMS 的訂單');

  const orders = pay_getOrders();
  const selected = orders.filter(o => ids.includes(o.id) && o.status === '待取貨');

  if(selected.length === 0) return alert('沒有符合條件的訂單（只能帶入待取貨訂單）');

  if(typeof window.sms_importFromPay === 'function'){
    window.sms_importFromPay(selected);
    mainSwitch('sms');
    alert(`✅ 已將 ${selected.length} 筆訂單帶入 SMS 模組！`);
  } else {
    alert('❌ SMS 模組尚未載入');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  pay_loadOrders();
});

