import {normalize,analyze,validateDate} from './engine.js';
const cache=new Map(),pending=new Map();
export function weatherURL(lake){const q=new URLSearchParams({latitude:lake.latitude,longitude:lake.longitude,hourly:'temperature_2m,precipitation_probability,wind_speed_10m,wind_gusts_10m',daily:'temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max',temperature_unit:'fahrenheit',wind_speed_unit:'mph',timezone:'America/Denver',forecast_days:'11',timeformat:'unixtime'});return `https://api.open-meteo.com/v1/forecast?${q}`;}
export async function forecast(lake,date){
 validateDate(date);const key=lake.id;let entry=cache.get(key);
 if(!entry||Date.now()-entry.timestamp>600000){
  if(!pending.has(key))pending.set(key,(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
   try{const response=await fetch(weatherURL(lake),{signal:controller.signal});if(!response.ok)throw new Error(response.status===429?'Weather request limit reached. Wait a few minutes and retry.':`Weather provider unavailable (${response.status}). Please retry.`);
    const raw=await response.json();if(raw.error)throw new Error(raw.reason||'Weather provider could not complete the request.');
    analyze(normalize(raw,date,lake));
    const result={raw,timestamp:Date.now(),retrievedAt:new Date().toISOString()};cache.set(key,result);return result;
   }catch(e){if(e.name==='AbortError')throw new Error('The weather request timed out. Please retry.');throw e;}finally{clearTimeout(timer);pending.delete(key);}
  })());
  try{entry=await pending.get(key);}catch(e){throw new Error(e.message==='Failed to fetch'?'Could not connect to Open-Meteo. Check your connection and retry.':e.message);}
 }
 try{return analyze(normalize(entry.raw,date,lake,entry.retrievedAt));}catch(e){cache.delete(key);throw e;}
}
