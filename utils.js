function getWeekday(date){
  return date.getDay()
}

function getThisWeek(date, target){
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay() + target)
  return d
}

function getNextWeek(date, target){
  const d = getThisWeek(date, target)
  d.setDate(d.getDate() + 7)
  return d
}

function fmt(d){
  return d.toISOString().slice(0,10)
}
