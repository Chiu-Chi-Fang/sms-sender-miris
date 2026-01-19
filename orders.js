let orders=JSON.parse(localStorage.getItem('orders')||'[]')


function addOrder(){
orders.push({
id:Date.now(),
orderNo:orderNo.value,
name:name.value,
phone:phone.value,
platform:platform.value,
pickupDate:null,
settlement:null,
payout:null
})
save()
}


function markPicked(id){
const o=orders.find(x=>x.id===id)
o.pickupDate=new Date().toISOString().slice(0,10)
const r=calculateDates(o.platform,o.pickupDate)
o.settlement=r.settlement
o.payout=r.payout
save()
}


function importCSV(e){
const file=e.target.files[0]
const reader=new FileReader()
reader.onload=()=>{
reader.result.split('
').slice(1).forEach(l=>{
const [no,name,phone,platform,date]=l.split(',')
if(!no)return
const r=calculateDates(platform,date)
orders.push({id:Date.now()+Math.random(),orderNo:no,name,phone,platform,pickupDate:date,settlement:r.settlement,payout:r.payout})
})
save()
}
reader.readAsText(file)
}


function save(){
localStorage.setItem('orders',JSON.stringify(orders))
render()
}


function render(){
orderList.innerHTML=''
orders.forEach(o=>{
orderList.innerHTML+=`<div class="order">#${o.orderNo}｜${o.platform}<br>
取件：${o.pickupDate||'未取'}<br>
結單：${o.settlement||'-'}<br>
撥款：${o.payout||'-'}<br>
${!o.pickupDate?`<button onclick="markPicked(${o.id})">已取貨</button>`:''}
</div>`
})
}
render()
