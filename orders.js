// 全部訂單
let orders = JSON.parse(localStorage.getItem('orders') || '[]')

// 當前勾選要發 SMS 的訂單 ID 集合
let selectedIds = new Set()

// --- 新增訂單（從兩步驟表單） ---
function addOrderFromForm(){
  const orderNoEl = document.getElementById('orderNo')
  const nameEl    = document.getElementById('name')
  const phoneEl   = document.getElementById('phone')
  const platformEl= document.getElementById('platform')
  const storeEl   = document.getElementById('store')
  const deadlineEl= document.getElementById('pickupDeadline')

  if(!orderNoEl.value || !nameEl.value || !phoneEl.value){
    alert('訂單編號、姓名、手機 為必填')
    return
  }

  const o = {
    id: Date.now(),
    orderNo: orderNoEl.value.trim(),
    name: nameEl.value.trim(),
    phone: phoneEl.value.trim(),
    platform: platformEl.value,
    store: storeEl.value.trim() || null,
    pickupDeadline: deadlineEl.value || null,
    pickupDate: null,
    settlement: null,
    payout: null,
    lastSmsAt: null,
    lastSmsContent: null
  }

  orders.push(o)
  saveOrders()
  
// --- 批量匯入訂單（從文字框） ---
function bulkImportFromText(){
  const textarea = document.getElementById('bulkInput')
  if(!textarea) return

  const text = textarea.value.trim()
  if(!text){
    alert('請先貼上要匯入的資料')
    return
  }

  const lines = text.split('\n')
  let success = 0
  let fail = 0

  lines.forEach(raw => {
    const line = raw.trim()
    if(!line) return

    // 1. 用逗號切，順便去掉前後空白
    const parts = line.split(',').map(p => p.trim())

    // 預期格式：
    // 0: 訂單編號
    // 1: 姓名
    // 2: 手機
    // 3: 平台（賣貨便 / 好賣+）
    // 4: 門市（可空）
    // 5: 取貨期限（YYYY-MM-DD，可空）
    if(parts.length < 3){
      fail++
      return
    }

    const orderNo = parts[0]
    const name    = parts[1]
    const phone   = parts[2]
    const platform= parts[3] || '賣貨便'
    const store   = parts[4] || ''
    const deadline= parts[5] || ''

    if(!orderNo || !name || !phone){
      fail++
      return
    }

    const o = {
      id: Date.now() + Math.random(),   // 避免同秒重複
      orderNo,
      name,
      phone,
      platform,
      store: store || null,
      pickupDeadline: deadline || null,
      pickupDate: null,
      settlement: null,
      payout: null,
      lastSmsAt: null,
      lastSmsContent: null
    }

    orders.push(o)
    success++
  })

  saveOrders()

  alert(`匯入完成：成功 ${success} 筆，失敗 ${fail} 筆`)
}

  // 清空表單 + 回到 Step1
  orderNoEl.value = ''
  nameEl.value = ''
  phoneEl.value = ''
  storeEl.value = ''
  deadlineEl.value = ''
  document.getElementById('step2').classList.add('hidden')
  document.getElementById('step1').classList.remove('hidden')
}

// --- 標記已取貨 ---
function markPicked(id){
  const o = orders.find(x => x.id === id)
  if(!o) return
  const today = new Date().toISOString().slice(0,10)
  o.pickupDate = today
  const r = calculateDates(o.platform, o.pickupDate)
  o.settlement = r.settlement
  o.payout     = r.payout
  saveOrders()
}

// --- 勾選 / 取消勾選 ---
function toggleSelect(id){
  if(selectedIds.has(id)) selectedIds.delete(id)
  else selectedIds.add(id)
  renderSelected()
}

function selectAllOrders(){
  orders.forEach(o => selectedIds.add(o.id))
  renderOrders()
  renderSelected()
}

function clearSelection(){
  selectedIds.clear()
  renderOrders()
  renderSelected()
}

// --- 儲存 + 重繪 ---
function saveOrders(){
  localStorage.setItem('orders', JSON.stringify(orders))
  renderOrders()
  renderRecent()
  renderSelected()
  renderSummary()
}

// --- 渲染：最近新增（新增頁右邊） ---
function renderRecent(){
  const box = document.getElementById('recentOrders')
  if(!box) return
  box.innerHTML = ''
  const latest = [...orders].slice(-5).reverse()
  latest.forEach(o => {
    const div = document.createElement('div')
    div.className = 'order-item'
    div.innerHTML = `
      <div class="order-main">
        <strong>#${o.orderNo}</strong>｜${o.name}<br>
        <span class="order-meta">${o.platform}｜${o.phone}</span>
      </div>
    `
    box.appendChild(div)
  })
}

// 在 orders.js 裡面的渲染函式
function renderOrders() {
  const listContainer = document.getElementById('orderList');
  listContainer.innerHTML = ''; // 清空列表

  // 假設 orders 是您的訂單資料陣列
  // 注意：請確認您的資料欄位是 item.orderNo 還是 item.id
  orders.forEach((item, index) => {
    
    // 判斷平台顏色
    const badgeClass = item.platform === '賣貨便' ? 'seven' : 'fami';
    
    // 建立一個漂亮的橫條 HTML
    const html = `
      <div class="order-item">
        <div class="col-check">
          <input type="checkbox" data-index="${index}" class="order-checkbox">
        </div>

        <div class="col-info">
          <strong>#${item.orderNo || '無編號'}</strong>
          <span class="platform-badge ${badgeClass}">${item.platform || '未知平台'}</span>
        </div>

        <div class="col-customer">
          <div>👤 ${item.name} <span style="margin-left:5px">📞 ${item.phone}</span></div>
          <div>📍 ${item.store || '未指定門市'}</div>
          ${item.pickupDeadline ? `<div style="color:#ff6b6b; font-size:12px">⏳ 期限: ${item.pickupDeadline}</div>` : ''}
        </div>

        <div class="col-action">
           <button class="btn small" onclick="toggleStatus(${index})">
             ${item.isPickedUp ? '✅ 已取貨' : '📦 待取貨'}
           </button>
        </div>
      </div>
    `;

    listContainer.innerHTML += html;
  });
}

// 綁定刪除按鈕的功能 (記得加在 script 裡)
document.getElementById('deleteSelectedBtn').addEventListener('click', () => {
  if(!confirm('確定要刪除選取的訂單嗎？')) return;
  
  // 這裡寫刪除邏輯，例如：
  // 1. 找出所有被勾選的 checkbox
  // 2. 從 orders 陣列中移除對應資料
  // 3. 重新 renderOrders()
  // 4. 儲存到 Firebase
  alert('功能需搭配後端邏輯實作'); 
});

// 初始 render
renderOrders()
renderRecent()
renderSelected()
renderSummary()
