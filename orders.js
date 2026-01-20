// orders.js - 雲端同步版 (修復按鈕失效 + 自動狀態更新)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const payOrdersRef = ref(db, 'pay_orders'); 

let payOrders = [];

// ==========================================
// ★★★ 1. 物流商 ID 對照表 ★★★
// ==========================================
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

onValue(payOrdersRef, (snapshot) => {
    const data = snapshot.val();
    payOrders = data || [];
    renderPayTable();
});

function savePayOrders() {
    set(payOrdersRef, payOrders).catch((err) => console.error('同步失敗', err));
}

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

// ==========================================
// ★★★ 2. 核心追蹤邏輯 (直接使用 Import 回傳結果) ★★★
// ==========================================
window.checkAllTracking = async function() {
    const indices = Array.from(document.querySelectorAll('.pay-chk:checked')).map(c => parseInt(c.dataset.idx));
    if(indices.length === 0) return alert('請先勾選要查詢的訂單');

    if(!confirm(`準備查詢 ${indices.length} 筆訂單...\n將透過匯入 API 自動取得最新貨況。`)) return;

    for (let i of indices) {
        await checkTrackingSingle(i);
        // 稍微暫停一下
        await new Promise(r => setTimeout(r, 800)); 
    }
    
    savePayOrders();
    alert('查詢完成！');
};

async function checkTrackingSingle(index) {
    const order = payOrders[index];
    const queryNo = order.trackingNum || order.no; 

    if(!queryNo) return;

    // 顯示查詢中...
    order.trackingStatus = "⏳ 查詢中...";
    renderPayTable();

    // 1. 取得 Carrier ID
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

    const apiToken = "WSKyGuq6SjJJoC4VwD0d81D66n83rhnkxWqPY0te32f27c21";
    let finalStatus = null;
    let errorMsg = "";

    try {
        console.log(`[${queryNo}] 呼叫 Import API...`);
        
        // 直接呼叫 Import，並讀取回傳結果
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

        // 嘗試讀取回傳資料
        const resData = await response.json();
        
        // 解析 Import 的回傳結構
        let packageData = null;
        if (Array.isArray(resData)) {
            packageData = resData[0];
        } else if (resData.data && Array.isArray(resData.data)) {
            packageData = resData.data[0];
        } else if (resData.id) {
            packageData = resData; 
        }

        // 如果 Import 成功回傳了資料，直接從這裡抓狀態！
        if (packageData) {
            console.log("取得包裹資料:", packageData);
            
            let statusText = "未知";
            if (packageData.package_history && packageData.package_history.length > 0) {
                const latest = packageData.package_history[0];
                statusText = latest.status || latest.checkpoint_status || "未知";
            } else if (packageData.status) {
