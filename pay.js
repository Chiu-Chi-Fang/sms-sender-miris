let orders = JSON.parse(localStorage.getItem('orders')||'[]')


function addOrder(){
const o={
id:Date.now(),
number:orderNumber.value,
name:customerName.value,
phone:phone.value,
platform:platform.value,
ship:shipDate.value
}
orders.push(o)
save()
}


function save(){
localStorage.setItem('orders',JSON.stringify(orders))
render()
}


function render(){
orderList.innerHTML=''
orders.forEach(o=>{
const d=document.createElement('div')
d.className='item'
d.innerHTML=`<strong>${o.number}</strong><br>${o.name}<br>${o.phone}`
orderList.appendChild(d)
})
}


render()
