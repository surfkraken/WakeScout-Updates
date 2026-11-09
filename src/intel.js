import {mountCoverage} from './intel-coverage.js';
import {createEditorialClient,createCombinedIntelClient} from './intel-editorial.js';
import {intelSource,intelLakeAliases} from '../data/intel-sources.js';
const intelDay=86400000;
const intelKinds={
 'Danger HAB':{severity:3,label:'Danger advisory',summary:'The agency lists a harmful algal bloom danger advisory. Check the official guidance before boating or entering the water.'},
 'Warning HAB':{severity:2,label:'Warning advisory',summary:'The agency lists a harmful algal bloom warning. Avoid algae while boating and review water-contact restrictions before wakesurfing.'},
 'Warning E coli':{severity:2,label:'Warning advisory',summary:'The agency lists an E. coli warning. Review water-contact restrictions before launching or wakesurfing.'},
 'Warning Mats':{severity:2,label:'Warning advisory',summary:'The agency lists a harmful algae mat warning. Check affected areas and water-contact guidance.'},
 'HAB HW':{severity:1,label:'Health watch',summary:'The agency lists a harmful algal bloom health watch. Review the affected area and current guidance before water contact.'},
 'E coli HW':{severity:1,label:'Health watch',summary:'The agency lists an E. coli health watch. Check current water-contact guidance before wakesurfing.'},
 'Mats CF':{severity:1,label:'Algae mat notice',summary:'The agency reports harmful algae mats. Avoid contact with mats and check the affected location.'},
};
const intelEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function intelDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;const n=Date.parse(s+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n:NaN;}
export function intelQuery(lakeId){const aliases=intelLakeAliases[lakeId];if(!aliases)throw Error('No verified lake alias.');const u=new URL(intelSource.endpoint);u.search=new URLSearchParams({where:`Waterbody IN (${aliases.map(a=>"'"+a.replaceAll("'","''")+"'").join(',')})`,outFields:'FID,Waterbody,Site_Name,Public_Name,Advisory,Advisory_Date,Monitored_Date,Hold_Date',orderByFields:'Monitored_Date DESC,FID ASC',returnGeometry:'false',resultRecordCount:String(intelSource.candidateLimit),f:'json'});return u.href;}
export function selectIntel(payload,lakeId,now=Date.now()){
 if(!payload||payload.error||!Array.isArray(payload.features)||payload.exceededTransferLimit)throw Error('Incomplete advisory response.');
 const aliases=intelLakeAliases[lakeId];if(!aliases)throw Error('No verified lake alias.');
 let matched=0,usable=0,uncertain=0;const groups=new Map();
 for(const feature of payload.features){const a=feature?.attributes;if(!a||typeof a.Waterbody!=='string'||!Object.hasOwn(a,'Advisory')||!Object.hasOwn(a,'Monitored_Date'))throw Error('Malformed advisory record.');
  if(!aliases.includes(a.Waterbody))continue;matched++;
  const monitored=intelDate(a.Monitored_Date),advisory=a.Advisory;
  // A missing status, held record, or old observation cannot establish an all-clear.
  if(!Number.isFinite(monitored)||monitored>now||now-monitored>intelSource.maxAgeDays*intelDay||a.Hold_Date===true||String(a.Hold_Date).toLowerCase()==='true'){uncertain++;continue;}
  if(advisory==='Looks Good'){usable++;continue;}
  const kind=intelKinds[advisory];if(!kind){uncertain++;continue;}
  const issued=typeof a.Advisory_Date==='number'&&Number.isFinite(a.Advisory_Date)?a.Advisory_Date:null;
  if(issued!==null&&issued>now){uncertain++;continue;}
  usable++;
  const key=[lakeId,advisory,issued??'undated'].join('|');
  const group=groups.get(key)??{id:key,lakeId,title:advisory,category:'Water Quality',...kind,issuedAt:issued,monitoredAt:monitored,sites:[],source:intelSource.name,url:intelSource.url};
  const site=String(a.Public_Name||a.Site_Name||a.Waterbody).trim();if(!group.sites.includes(site))group.sites.push(site);
  group.monitoredAt=Math.max(group.monitoredAt,monitored);groups.set(key,group);
 }
 const items=[...groups.values()].sort((a,b)=>b.severity-a.severity||b.monitoredAt-a.monitoredAt||a.id.localeCompare(b.id)).slice(0,5);
 return {items,matched,usable,uncertain,status:items.length?'items':usable?'empty':'unavailable',partial:uncertain>0||matched===0};
}
export function createIntelClient({fetcher=(...args)=>fetch(...args),clock=()=>Date.now(),timeoutMs=intelSource.timeoutMs,ttl=intelSource.cacheMs}={}){
 const cache=new Map(),pending=new Map();
 return {load(lakeId,{fresh=false}={}){
  const now=clock(),saved=cache.get(lakeId);if(!fresh&&saved&&now-saved.checkedAt<ttl)return Promise.resolve(saved);
  if(pending.has(lakeId))return pending.get(lakeId);
  const request=(async()=>{const controller=new AbortController();let timer;
   try{const payload=await Promise.race([(async()=>{const r=await fetcher(intelQuery(lakeId),{signal:controller.signal,cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('Advisory source unavailable.');return r.json();})(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Advisory request timed out.'));},timeoutMs);})]);
    const result={...selectIntel(payload,lakeId,clock()),checkedAt:clock()};cache.set(lakeId,result);return result;
   }finally{clearTimeout(timer);pending.delete(lakeId);}
  })();pending.set(lakeId,request);return request;
 }};
}
const intelClient=createCombinedIntelClient(createIntelClient(),createEditorialClient());
function intelStamp(n,dateOnly=false){return new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',...(dateOnly?{dateStyle:'medium'}:{dateStyle:'medium',timeStyle:'short'})}).format(n);}
export function intelMarkup(lake,result){
 const e=intelEscape;
 const cards=result.items.map(i=>i.kind==='editorial'?`<article class="intel-card"><div class="intel-tags"><span>${e(i.category)}</span><span>${e(i.label)}${i.scope==='statewide'?' · statewide':''}</span></div><h3>${e(i.title)}</h3><p class="intel-source">${e(i.source)}</p><p class="intel-dates">${i.publishedAt?'Published '+e(intelStamp(Date.parse(i.publishedAt),true)):'Publication date not supplied'}${i.updatedAt?' · Updated '+e(intelStamp(Date.parse(i.updatedAt),true)):''}<br>Reviewed ${e(intelStamp(Date.parse(i.reviewedAt)))} · ${i.applicability==='ongoing'?'Ongoing applicability reconfirmed':'Recent report'}${i.effectiveAt?'<br>Effective: '+e(intelStamp(Date.parse(i.effectiveAt),true)):''}${i.effectiveUntil?' · Ends: '+e(intelStamp(Date.parse(i.effectiveUntil),true)):''}</p><p>${e(i.summary)}</p><a href="${e(i.url)}" target="_blank" rel="noopener noreferrer">Read original source ↗</a>${i.corroborationURL&&i.corroborationURL!==i.url?` · <a href="${e(i.corroborationURL)}" target="_blank" rel="noopener noreferrer">Current supporting information ↗</a>`:''}</article>`:`<article class="intel-card"><div class="intel-tags"><span>${e(i.category)}</span><span>${e(i.label)} · agency status</span></div><h3>${e(i.title)} · ${e(lake.name)}</h3><p class="intel-source">${e(i.source)}</p><p class="intel-dates">${i.issuedAt!==null?'Advisory dated '+e(intelStamp(i.issuedAt,true)):'Advisory date not supplied'} · Publication date not supplied<br>Latest monitoring date: ${e(intelStamp(i.monitoredAt+12*3600000,true))}. Effective and expiry dates not supplied.</p><p>${e(i.summary)}</p><p class="intel-sites">Locations: ${e(i.sites.slice(0,3).join('; '))}${i.sites.length>3?` and ${i.sites.length-3} more`:''}.</p><a href="${e(i.url)}" target="_blank" rel="noopener noreferrer">Open official advisory map ↗</a></article>`).join('');
 const state=result.status==='empty'?'<p class="intel-message">No recent lake-specific alerts found.</p>':result.status==='unavailable'?'<p class="intel-message">Lake Intel is temporarily unavailable.</p><p>One or more checks lack sufficiently recent, usable information. This is not an all-clear.</p>':'';
 return `<p class="intel-checked">${result.waterCheckedAt===null?'Water-quality source could not be checked':'Last checked: '+e(intelStamp(result.waterCheckedAt??result.checkedAt))} · Utah time${result.editorialCheckedAt?'<br>Editorial sources reviewed: '+e(intelStamp(result.editorialCheckedAt)):result.editorialUnavailable?'<br>No current editorial review is available for this lake.':''}</p>${state}${cards}${result.editorialUnavailable?'<p class="intel-caution">Local news and access checks are incomplete or their review has expired. No all-clear can be inferred.</p>':''}${result.waterUnavailable?'<p class="intel-caution">Live water-quality status is unavailable. Check the official map.</p>':''}${result.uncertain?'<p class="intel-caution">Some records were undated, older than our 45-day review window, missing a status, or not available. Current status could not be established for those records.</p>':''}<p class="intel-caution">${result.status==='empty'?'This does not guarantee that conditions or access are safe. Check official lake information before launching.':'Conditions and access can change. Check official lake information before launching.'}</p>`;
}
export function mountLakeIntel(lake,client=intelClient){
 const host=document.querySelector('#lake-intel');if(!host)return;
 host.innerHTML=`<header><p class="eyebrow">LAKE INTEL</p><h2>Know before you launch.</h2><p>${intelEscape(lake.name)} · Current information, not a forecast for your selected date.</p></header><p class="intel-coverage">Live Utah DEQ water-quality records plus reviewed local reporting and access notices. Reviewed advisories are supplemented by automatically collected lake-specific headlines. Headlines are unverified; source coverage may be incomplete.</p><div class="intel-content" role="status" aria-live="polite"><p>Checking Lake Intel sources…</p></div><div class="intel-official"><a href="${intelEscape(lake.source)}" target="_blank" rel="noopener noreferrer">Official lake reference ↗</a><a href="${intelSource.rampURL}" target="_blank" rel="noopener noreferrer">Utah State Parks ramp conditions ↗</a><a href="${intelSource.url}" target="_blank" rel="noopener noreferrer">Official water-quality map ↗</a></div>`;
 void mountCoverage(host,lake.id);
 const content=host.querySelector('.intel-content');const current=()=>host.isConnected&&document.querySelector('#lake-intel')===host;
 const load=async fresh=>{content.innerHTML='<p>Checking Lake Intel sources…</p>';try{const result=await client.load(lake.id,{fresh});if(current()){content.innerHTML=intelMarkup(lake,result)+'<button type="button" class="action-button intel-retry">Check Lake Intel again</button>';content.querySelector('.intel-retry').onclick=()=>void load(true);}}catch{if(!current())return;content.innerHTML='<p class="intel-message">Lake Intel is temporarily unavailable.</p><p>The source could not be checked. This is not an all-clear.</p><button type="button" class="action-button intel-retry">Retry Lake Intel</button>';content.querySelector('.intel-retry').onclick=()=>void load(true);}};
 void load(false);
}
