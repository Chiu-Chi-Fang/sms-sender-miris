function calculateDates(platform, pickupDate){
  if(!pickupDate) return { settlement:null, payout:null }

  const d = new Date(pickupDate)
  const w = d.getDay()
  let settlement, payout

  if(platform === '賣貨便'){
    if(w >= 1 && w <= 3){
      // 一～三取件：本週四結算，下週一撥款
      settlement = getThisWeek(d, 4)
      payout     = getNextWeek(settlement, 1)
    }else{
      // 四～日取件：下週一結算，本週三撥款
      settlement = getNextWeek(d, 1)
      payout     = getThisWeek(settlement, 3)
    }
  }

  if(platform === '好賣+'){
    if(w >= 1 && w <= 3){
      // 一～三取件：本週五結算，下週二撥款
      settlement = getThisWeek(d, 5)
      payout     = getNextWeek(settlement, 2)
    }else{
      // 四～日取件：下週三結算，本週四撥款
      settlement = getNextWeek(d, 3)
      payout     = getThisWeek(settlement, 4)
    }
  }

  return {
    settlement: settlement ? fmt(settlement) : null,
    payout:     payout ? fmt(payout) : null
  }
}
