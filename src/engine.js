export const qualities = ['Excellent', 'Good', 'Fair', 'Marginal'];
export const finite = v => typeof v === 'number' && Number.isFinite(v);
export function quality({avgWind,maxGust,maxRain}) {
  if (![avgWind,maxGust,maxRain].every(finite)) throw new Error('Missing ranking measurements');
  return avgWind<=6 && maxGust<=15 && maxRain<=5 ? 'Excellent' : avgWind<=10 && maxGust<=20 && maxRain<=15 ? 'Good' : avgWind<=15 && maxGust<=25 && maxRain<=30 ? 'Fair' : 'Marginal';
}
export function localParts(instant, timezone='America/Denver') {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,hour:+p.hour,minute:+p.minute,second:+p.second};
}
export function localEpoch(value, timezone) {
  if (finite(value)) return value*1000;
  if (typeof value!=='string') return NaN;
  if (/Z$|[+-]\d\d:\d\d$/.test(value)) return Date.parse(value);
  const target=Date.parse(value+'Z'); let t=target;
  for(let i=0;i<4;i++){const p=localParts(t,timezone);const represented=Date.parse(`${p.date}T${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}:${String(p.second).padStart(2,'0')}Z`); t+=target-represented;}
  return t;
}
export const today = (now=Date.now()) => localParts(now).date;
export function addDays(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function validateDate(date,now=Date.now()) {const start=today(now);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date<start||date>addDays(start,10))throw new Error('Choose today or a date within the next 10 days (Utah time).');}
const avg = xs => xs.every(finite)?xs.reduce((s,x)=>s+x,0)/xs.length:null;
const min = xs => xs.length && xs.every(finite)?Math.min(...xs):null;
const max = xs => xs.length && xs.every(finite)?Math.max(...xs):null;
export function normalize(raw,date,lake,retrievedAt=new Date().toISOString()) {
  const timezone=raw.timezone;if(timezone!=='America/Denver')throw new Error('Unexpected weather timezone. Please retry.');
  if(!finite(raw.latitude)||!finite(raw.longitude)||Math.abs(raw.latitude-lake.latitude)>0.5||Math.abs(raw.longitude-lake.longitude)>0.5)throw new Error('Unexpected weather coordinates. Please retry.');
  if(raw.hourly_units?.precipitation_probability!=='%')throw new Error('Unexpected precipitation units. Please retry.');
  const d=raw.daily,h=raw.hourly;
  if(!d?.time||!h?.time)throw new Error('Weather provider returned an incomplete forecast.');
  const idx=d.time.findIndex(t=>(finite(t)?localParts(t*1000,timezone).date:String(t).slice(0,10))===date);
  if(idx<0)throw new Error('The provider has no forecast for this date. Try an earlier date.');
  if(raw.hourly_units?.wind_speed_10m!=='mp/h'||raw.hourly_units?.wind_gusts_10m!=='mp/h'||raw.hourly_units?.temperature_2m!=='°F')throw new Error('Unexpected weather units. Please retry.');
  const hours=h.time.map((t,i)=>({instant:localEpoch(t,timezone),wind:h.wind_speed_10m?.[i],gust:h.wind_gusts_10m?.[i],rain:h.precipitation_probability?.[i],temp:h.temperature_2m?.[i]})).filter(x=>finite(x.instant)&&localParts(x.instant,timezone).date===date);
  if(new Set(hours.map(h=>h.instant)).size!==hours.length)throw new Error('Duplicate hourly timestamps. Please retry.');
  const sunrise=localEpoch(d.sunrise?.[idx],timezone), sunset=localEpoch(d.sunset?.[idx],timezone);
  if(!finite(sunrise)||!finite(sunset)||sunset<=sunrise)throw new Error('Daylight information is unavailable for this date.');
  const midnight=localEpoch(date+'T00:00:00',timezone),nextMidnight=localEpoch(addDays(date,1)+'T00:00:00',timezone);
  const complete=hours.length===(nextMidnight-midnight)/3600000&&hours.every((h,i)=>h.instant===midnight+i*3600000);
  const dayGust=complete?max(hours.map(x=>x.gust)):null;
  return {lake,date,timezone,sunrise,sunset,highF:d.temperature_2m_max?.[idx]??null,lowF:d.temperature_2m_min?.[idx]??null,uv:d.uv_index_max?.[idx]??null,hourlyCoverageComplete:complete,dayMaxWind:complete?max(hours.map(x=>x.wind)):null,dayMaxGust:dayGust,dayMaxRain:complete?max(hours.map(x=>x.rain)):null,dayMaxGustTime:dayGust===null?null:hours.find(x=>x.gust===dayGust)?.instant,hours,retrievedAt};
}
export function conditionsCompare(a,b){return qualities.indexOf(quality(a))-qualities.indexOf(quality(b)) || a.avgWind-b.avgWind || a.maxWind-b.maxWind || a.maxGust-b.maxGust || a.maxRain-b.maxRain;}
export function windowCompare(a,b){return conditionsCompare(a,b)||a.start-b.start;}
export function lakeCompare(a,b){return conditionsCompare(a.best,b.best) || (finite(a.driveMinutes)&&finite(b.driveMinutes)?a.driveMinutes-b.driveMinutes:0) || a.lake.name.localeCompare(b.lake.name);}
export function analyze(day,now=Date.now()) {
  const p=localParts(day.sunrise,day.timezone);
  const first=day.sunrise+(p.minute||p.second?3600-p.minute*60-p.second:0)*1000;
  const byInstant=new Map(day.hours.map(h=>[h.instant,h])); const candidates=[];
  for(let start=first;start+10800000<=day.sunset;start+=3600000){
    const slots=[0,1,2].map(i=>byInstant.get(start+i*3600000));
    const valid=slots.every(h=>h&&[h.wind,h.gust,h.rain].every(finite)&&h.wind>=0&&h.gust>=0&&h.rain>=0&&h.rain<=100);
    const base={lake:day.lake.name,date:day.date,start,end:start+10800000,eligible:valid,exclusionReason:valid?null:'Missing or invalid hourly weather',elapsed:start<now};
    if(!valid){candidates.push(base);continue;}
    const winds=slots.map(h=>h.wind),gusts=slots.map(h=>h.gust),temps=slots.map(h=>h.temp);
    const c={...base,avgWind:avg(winds),minWind:min(winds),maxWind:max(winds),maxGust:max(gusts),maxRain:max(slots.map(h=>h.rain)),windowAvg:avg(temps),windowLow:min(temps),windowHigh:max(temps),dayHigh:day.highF,dayLow:day.lowF};
    c.maxGustTime=slots.find(h=>h.gust===c.maxGust).instant;c.quality=quality(c);candidates.push(c);
  }
  if(!candidates.length)throw new Error('No full three-hour daylight window is available on this date.');
  const dry=candidates.some(c=>c.eligible&&c.maxRain<=30);
  for(const c of candidates)if(c.eligible&&dry&&c.maxRain>30){c.eligible=false;c.exclusionReason='Rain guardrail: another window has rain probability at or below 30%';}
  const ranked=candidates.filter(c=>c.eligible).sort(windowCompare);
  if(!ranked.length)throw new Error('Hourly weather is incomplete for every daylight window. Please retry later.');
  return {...day,candidates,ranked,best:ranked[0],driveMinutes:null};
}
export function explain(results) {
 const a=results[0],b=results[1]; if(!b)return `${a.lake.name} has ${a.best.quality.toLowerCase()} conditions during its best daylight window.`;
 const fields=[['quality','higher surf quality'],['avgWind','lighter average wind'],['maxWind','lower peak sustained wind'],['maxGust','softer peak gusts'],['maxRain','lower rain probability']];
 const diff=fields.find(([k])=>a.best[k]!==b.best[k]);
 return diff?`${a.lake.name} ranks first with ${diff[1]} than the next-ranked lake.`:`${a.lake.name} shares the best weather conditions; tied lakes are listed alphabetically because drive times are unavailable.`;
}
