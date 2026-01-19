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

// --- 渲染：訂單列表 ---
function renderOrders(){
  const list = document.getElementById('orderList')
  if(!list) return
  list.innerHTML = ''

  orders.slice().reverse().forEach(o => {
    const wrap = document.createElement('div')
    wrap.className = 'order-item'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = selectedIds.has(o.id)
    checkbox.onchange = () => toggleSelect(o.id)

    const main = document.createElement('div')
    main.className = 'order-main'
    main.innerHTML = `
      <strong>#${o.orderNo}</strong>｜${o.name}｜${o.platform}<br>
      <span class="order-meta">
        📱 ${o.phone}${o.store ? '｜🏪 '+o.store : ''}<br>
        取件：${o.pickupDate || '未取'}<br>
        結算：${o.settlement || '-'}｜撥款：${o.payout || '-'}<br>
        ${o.lastSmsAt ? `<span class="badge">上次 SMS：${o.lastSmsAt}</span>` : ''}
      </span>
    `

    const actions = document.createElement('div')
    actions.className = 'order-actions'

    if(!o.pickupDate){
      const btnPick = document.createElement('button')
      btnPick.className = 'btn small'
      btnPick.textContent = '已取貨（今天）'
      btnPick.onclick = () => markPicked(o.id)
      actions.appendChild(btnPick)
    }

    wrap.appendChild(checkbox)
    wrap.appendChild(main)
    wrap.appendChild(actions)

    list.appendChild(wrap)
  })
}

// --- 渲染：SMS Tab 左側（已勾選訂單） ---
function renderSelected(){
  const box = document.getElementById('selectedOrders')
  if(!box) return
  box.innerHTML = ''

  const selectedList = orders.filter(o => selectedIds.has(o.id))
  if(selectedList.length === 0){
    box.innerHTML = '<div class="order-meta">尚未勾選任何訂單，可到「訂單列表」勾選。</div>'
    return
  }

  selectedList.forEach(o => {
    const div = document.createElement('div')
    div.className = 'order-item'
    div.innerHTML = `
      <div class="order-main">
        <strong>#${o.orderNo}</strong>｜${o.name}<br>
        <span class="order-meta">
          📱 ${o.phone}｜${o.platform}${o.store ? '｜🏪 '+o.store : ''}<br>
          撥款：${o.payout || '-'}
        </span>
      </div>
    `
    box.appendChild(div)
  })
}

// --- 簡單撥款 summary ---
function renderSummary(){
  const box = document.getElementById('summary')
  if(!box) return
  const byDate = {}
  orders.forEach(o => {
    if(!o.payout) return
    if(!byDate[o.payout]) byDate[o.payout] = 0
    byDate[o.payout] += 1
  })
  const dates = Object.keys(byDate).sort()
  if(dates.length === 0){
    box.textContent = '目前尚未有已計算之撥款。'
    return
  }
  box.innerHTML = dates.map(d => `${d}：${byDate[d]} 筆訂單`).join('<br>')
}

// 初始 render
renderOrders()
renderRecent()
renderSelected()
renderSummary()
