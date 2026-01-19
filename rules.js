function calculateDates(platform, pickupDate){
const d=new Date(pickupDate)
const w=d.getDay()
let settlement,payout


if(platform==='賣貨便'){
if(w>=1&&w<=3){
settlement=getThisWeek(d,4)
payout=getNextWeek(settlement,1)
}else{
settlement=getNextWeek(d,1)
payout=getThisWeek(settlement,3)
}
}


if(platform==='好賣+'){
if(w>=1&&w<=3){
settlement=getThisWeek(d,5)
payout=getNextWeek(settlement,2)
}else{
settlement=getNextWeek(d,3)
payout=getThisWeek(settlement,4)
}
}


return {settlement:fmt(settlement),payout:fmt(payout)}
}
