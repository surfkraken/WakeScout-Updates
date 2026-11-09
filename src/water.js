import {temperatureProvenance} from '../data/temperature-provenance.js';
// The original CSV remains the editable source of truth. No weather adjustment.
export function parseBaselines(csv) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<csv.length;i++){
    const c=csv[i];
    if(c==='"'){if(quoted&&csv[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&csv[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('Incomplete baseline CSV');
  if(cell||row.length){row.push(cell);rows.push(row);}
  const headers=rows.shift()||[];
  if(!['lake','month_number','average_f','data_type','source_url'].every(k=>headers.includes(k)))throw new Error('Missing baseline columns');
  return rows.map(values=>Object.fromEntries(headers.map((key,i)=>[key,values[i]?.trim()??''])));
}
export function seasonalEstimate(rows,lake,date) {
  const month=Number(date.slice(5,7));if(!Number.isInteger(month)||month<1||month>12)return null;
  const matches=rows.filter(r=>r.lake===lake&&Number(r.month_number)===month);
  if(matches.length!==1)return null;
  const r=matches[0],average=Number(r.average_f);
  if(!r.average_f||!Number.isFinite(average))return null;
  const basis=temperatureProvenance.basisLabels[r.data_type]||'Seasonal reference with unspecified basis';
  return {averageF:average,month:r.month,monthNumber:month,basis,dataType:r.data_type,verificationStatus:r.verification_status,disclosure:temperatureProvenance.unresolvedLakes.includes(lake)?temperatureProvenance.unresolvedDisclosure:temperatureProvenance.publishedDisclosure,sourceURL:/^https:\/\//.test(r.source_url)?r.source_url:null};
}

export async function loadOptionalBaselines(fetcher=fetch,timeoutMs=3000){
 const controller=new AbortController();let timer;
 try{return await Promise.race([(async()=>{const response=await fetcher('data/WakeScout_v4_Lake_Temperature_Baselines.csv',{signal:controller.signal});if(!response.ok)return [];return parseBaselines(await response.text());})(),new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve([]);},timeoutMs);})]);}catch{return [];}finally{clearTimeout(timer);}
}
