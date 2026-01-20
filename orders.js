// orders.js - 雲端同步版 (修復截斷問題 + 完整功能)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

console.log("🚀 開始載入 orders.js...");

// ★★★ 請填入您的 Firebase 設定 (sms-miris) ★★★
const firebaseConfig = {
  apiKey: "AIzaSyDcKclyNssDs08E0DIwfrc7lzq3QQL4QS8",
  authDomain: "sms-miris.firebaseapp.com",
  databaseURL: "https://sms-miris-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sms-miris",
  storageBucket: "sms-miris.firebasestorage.app",
  messagingSenderId: "340097404227",
  appId: "1:340097404227:web:554901219608cbed42f3f6"
};

// 1. 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const payOrdersRef = ref(db, 'pay_orders'); 

// 2. 全域變數
let payOrders = [];

// 3. 物流商 ID 對照表
const carrierMap = {
    '7-11': '9a980809-8865-4741-9f0a-3daaaa7d9e19',
    '賣貨便': '9a980809-8865-4741-9f0a-3daaaa7d9e19',
    '全家': '9a980968-0ecf-4ee5-8765-fbeaed8a524e',
    '好賣+': '9a980968-0ecf-4ee5-8765-fbeaed8a524e',
    '萊爾富': '9a980b3f-450f-4564-b73e-2ebd867666b0',
    'OK': '9a980d97-1101-4adb-87eb-78266878b384',
    '蝦皮': '9a98100c-c984-463d-82a6-ae86ec4e0b8a',
    '宅配通': '9a984351-dc4f-405b-971c-671220c75f21',
    '新竹物流': '9a9840bc-a5d9-4c4a-8cd2-a79031b4ad53',
    '嘉里大榮': '9a98424a-935f-4b23-9a94-a08e1db52944',
    '黑貓': '9a98160d-27e3-40ab-9357-9d81466614e0',
    '郵局': '9a9812d2-c275-4726-9bdc-2ae5b4c42c73'
};

// 4. 監聽雲端資料
onValue(payOrdersRef, (snapshot) => {
    const data = snapshot.val();
    payOrders = data || [];
    renderPayTable();
    console.log("☁️ 資料同步完成，目前訂單數:", payOrders.length);
});

// ==========================================
// 核心功能函式定義
// ==========================================

function savePayOrders() {
    set(payOrdersRef, payOrders)
        .then(() => console.log('同步成功'))
        .catch((err) => console.error('同步失敗', err));
}

// --- 日期工具 ---
function getNextWeekday(date, targetDay) {
    const d = new Date(date);
    const cur = d.getDay(); 
    let add = targetDay - cur;
    if (add <= 0) add += 7; 
    d.setDate(d.getDate() + add);
    return d;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function calculatePaymentDate(platform, pickupDateStr) {
    if (!pickupDateStr) return { settlement: '-', payment: '-' };
    const pickupDate = new Date(pickupDateStr);
    const dow = pickupDate.getDay(); 
    let settlementDate, paymentDate;

    if (platform && (platform.includes('賣貨便') || platform.includes('7-11'))) {
        if (dow >= 1 && dow <= 3) { 
            settlementDate = getNextWeekday(pickupDate, 4);
            paymentDate = addDays(settlementDate, 4);
        } else {
            settlementDate = getNextWeekday(pickupDate, 1);
            paymentDate = addDays(settlementDate, 2);
        }
    } else {
        if (dow >= 1 && dow <= 3) {
            settlementDate = getNextWeekday(pickupDate, 5);
            paymentDate = addDays(settlementDate, 4);
        } else {
            settlementDate = getNextWeekday(pickupDate, 3);
            paymentDate = addDays(settlementDate, 1);
        }
    }
    return {
        settlement: settlementDate.toISOString().split('T')[0],
        payment: paymentDate.toISOString().split('T')[0]
    };
}

// --- 批量匯入功能 ---
function importFromTextImpl() {
    console.log("執行匯入功能...");
    const el = document.getElementById('importText');
    if (!el) {
        alert('找不到輸入框，請確認您在「新增/匯入」分頁');
        return;
    }
    const txt = el.value;
    if(!txt) return alert('請先貼上資料喔！');

    const lines = txt.split('\n');
    let count = 0;

    lines.forEach(line => {
        if(!line.trim()) return;
        // 兼容 Tab 或逗號分隔
        const cols = line.trim().split(/[|\t,\s]+/).filter(Boolean);

        if(cols.length >= 3) {
            let rawPlatform = cols[3] || '';
            let finalPlatform = rawPlatform;
            if(rawPlatform.includes('賣貨便')) finalPlatform = '7-11';
            else if(rawPlatform.includes('好賣')) finalPlatform = '全家';

            // 讀取第 8 欄 (物流單號)，索引是 7
            let trackNo = cols[7] || '';

            payOrders.push({
                no: cols[0], 
                name: cols[1], 
                phone: cols[2], 
                platform: finalPlatform,
                store: cols[4] || '', 
                shipDate: cols[5] || '', 
                deadline: cols[6] || '',
                trackingNum: trackNo, // 存入物流單號
                pickupDate: null, 
                trackingStatus: ''
            });
            count++;
        }
    });

    if(count > 0) {
        savePayOrders();
        alert(`成功匯入 ${count} 筆資料！`);
        el.value = '';
        if(window.switchPaySubTab) window.switchPaySubTab('orders');
    } else {
        alert('匯入失敗：格式不符');
    }
}

// --- 智慧追蹤功能 ---
async function checkAllTrackingImpl() {
    const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx));
    if(indices.length === 0) return alert('請先勾選要查詢的訂單');

    if(!confirm(`準備查詢 ${indices.length} 筆訂單...\n系統將透過匯入 API 自動取得最新貨況。`)) return;

    for (let i of indices) {
        await checkTrackingSingle(i);
        // 暫停 800ms 避免太快
        await new Promise(r => setTimeout(r, 800)); 
    }
    
    savePayOrders();
    alert('查詢完成！');
}

async function checkTrackingSingle(index) {
    const order = payOrders[index];
    const queryNo = order.trackingNum || order.no; 

    if(!queryNo) return;

    order.trackingStatus = "⏳ 查詢中...";
    renderPayTable();

    // 取得 Carrier ID
    let carrierId = "";
    if (order.platform) {
        const keys = Object.keys(carrierMap);
        for(let key of keys) {
            if(order.platform.includes(key)) {
                carrierId = carrierMap[key];
                break;
            }
        }
    }

    // 如果沒有對應的物流商，直接跳過
    if (!carrierId) {
        order.trackingStatus = "未知物流商";
        renderPayTable();
        return;
    }

    const apiToken = "WSKyGuq6SjJJoC4VwD0d81D66n83rhnkxWqPY0te32f27c21";
    let finalStatus = null;
    let errorMsg = "";

    try {
        console.log(`[${queryNo}] 呼叫 API...`);
        
        const response = await fetch('https://track.tw/api/v1/package/import', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${apiToken}`,
                'accept': 'application/json'
            },
            body: JSON.stringify({
                "carrier_id": carrierId,
                "tracking_number": [queryNo], // 必須是陣列
                "notify_state": "inactive"
            })
        });

        const resData = await response.json();
        
        let packageData = null;
        if (Array.isArray(resData)) {
            packageData = resData[0];
        } else if (resData.data && Array.isArray(resData.data)) {
            packageData = resData.data[0];
        } else if (resData.id) {
            packageData = resData; 
        }

        if (packageData) {
            let statusText = "未知";
            if (packageData.package_history && packageData.package_history.length > 0) {
                const latest = packageData.package_history[0];
                statusText = latest.status || latest.checkpoint_status || "未知";
            } else if (packageData.status) {
                statusText = packageData.status;
            }

            // 狀態翻譯
            if (statusText === "delivered") statusText = "已配達";
            if (statusText === "transit") statusText = "配送中";
            if (statusText === "pending") statusText = "待出貨";
            if (statusText === "picked_up") statusText = "已取件";
            if (statusText === "shipping") statusText = "運送中";
            if (statusText === "arrived") statusText = "已配達";

            finalStatus = statusText;

            // 自動勾選已取 + 填入日期
            if (statusText.match(/已配達|已取|完成|delivered|arrived/)) {
                if(!order.pickupDate) {
                    const today = new Date().toISOString().split('T')[0];
                    order.pickupDate = today;
                }
            }
        } else {
            errorMsg = `API格式異常`;
            console.warn("API回傳:", resData);
        }

    } catch (error) {
        console.error(`單號 ${queryNo} 處理失敗:`, error);
        errorMsg = "連線失敗"; 
    }

    if (finalStatus) {
        order.trackingStatus = finalStatus;
    } else {
        order.trackingStatus = "LINK_FALLBACK";
        order.debugMsg = errorMsg; 
    }
    
    renderPayTable();
}

// --- 渲染表格 ---
function renderPayTable() {
    const tbody = document.getElementById('payTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    const totalCount = payOrders.length;
    const pickedCount = payOrders.filter(o => o.pickupDate).length;
    const unpickedCount = totalCount - pickedCount;

    // 更新計數器 (修復這段之前斷掉的程式碼)
    if(document.getElementById('cnt-all')) document.getElementById('cnt-all').innerText = `(${totalCount})`;
    if(document.getElementById('cnt-picked')) document.getElementById('cnt-picked').innerText = `(${pickedCount})`;
    if(document.getElementById('cnt-unpicked')) document.getElementById('cnt-unpicked').innerText = `(${unpickedCount})`;

    if (payOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#999; padding:20px;">☁️ 目前無訂單，請從 Excel 複製貼上</td></tr>`;
        return;
    }

    const filterEl = document.querySelector('input[name="statusFilter"]:checked');
    const filterVal = filterEl ? filterEl.value : 'all'; 

    payOrders.forEach((order, index) => {
        const isPicked = !!order.pickupDate; 
        if (filterVal === 'picked' && !isPicked) return;
        if (filterVal === 'unpicked' && isPicked) return;

        const queryNo = order.trackingNum || order.no;

        // 物流狀態顯示
        let trackHtml = '<span style="color:#ccc;">-</span>';
        
        if (order.trackingStatus === "LINK_FALLBACK") {
            let linkUrl = "#";
            let linkText = "🔍 查官網";
            let btnColor = "#6c757d"; 

            if (order.platform && (order.platform.includes("7-11") || order.platform.includes("賣貨便"))) {
                linkUrl = `https://eservice.7-11.com.tw/E-Tracking/search.aspx?shipNum=${queryNo}`;
                linkText = "查 7-11";
                btnColor = "#27ae60"; 
            } else if (order.platform && (order.platform.includes("全家") || order.platform.includes("好賣"))) {
                linkUrl = `https://www.famiport.com.tw/Web_Famiport/page/process.aspx`; 
                linkText = "查 全家";
                btnColor = "#2980b9"; 
            }

            trackHtml = `
                <a href="${linkUrl}" target="_blank" class="btn btn-sm" style="background:${btnColor}; color:white; font-size:12px; padding:2px 8px; text-decoration:none;">${linkText}</a>
                ${order.debugMsg ? `<div style="font-size:9px; color:red; margin-top:2px;">${order.debugMsg}</div>` : ''}
