'use strict';
function suggestExpenseCategory(desc, history, keywords, categories) {
  const normalize = x => String(x || '').trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');
  const text = normalize(desc);
  if (!text) return 'sonstiges';
  const counts = new Map();
  // Reverse order: newest category wins when frequency is tied.
  for (const e of history.slice().reverse()) {
    if (normalize(e.desc) !== text || !categories.includes(e.category)) continue;
    counts.set(e.category, (counts.get(e.category) || 0) + 1);
  }
  if (counts.size) return [...counts].sort((a,b) => b[1]-a[1])[0][0];
  for (const [cat, words] of Object.entries(keywords)) {
    if (categories.includes(cat) && words.some(w => text.includes(w))) return cat;
  }
  return 'sonstiges';
}
function anniversaryDate(base, year) {
  if (!validDate(base)) return null;
  const month = Number(base.slice(5,7)), day = Number(base.slice(8,10));
  return localDateStr(new Date(year, month - 1, Math.min(day, new Date(year, month, 0).getDate())));
}
function recurringDueDate(r, date) {
  if (!validDate(date)) return null;
  const base = r.startDate || '2000-01-01';
  return anniversaryDate(base, Number(date.slice(0,4)));
}
function advanceReadingDate(meter) {
  const interval = Number(meter.readingIntervalMonths || 0);
  if (![1,3,12].includes(interval) || !validDate(meter.nextReading)) return;
  const last = (meter.readings || []).reduce((d,r) => r.date > d ? r.date : d, '');
  const anchor = Number(meter.readingDay || meter.nextReading.slice(8,10));
  meter.readingDay = anchor;
  while (meter.nextReading <= last) {
    const [y,m] = meter.nextReading.split('-').map(Number);
    const next = new Date(y, m - 1 + interval, 1);
    next.setDate(Math.min(anchor, new Date(next.getFullYear(), next.getMonth()+1, 0).getDate()));
    meter.nextReading = localDateStr(next);
  }
}
function collectStoredAppSnapshot(read, strip) {
  const data = {};
  for (const [field,key] of Object.entries(HH_DATA_KEYS)) {
    const list = ['contracts','meters','expenses','recurring','transfers','recipes','concerts','ticketPeople'].includes(field);
    data[field] = read(key, list ? [] : {});
  }
  data.settings = strip(data.settings);
  return {...data,schemaVersion:43,exported:new Date().toISOString(),notfall:true};
}
