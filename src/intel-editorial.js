// Reviewed link bulletin. This is not an automated news search or a web scraper.
export const intelPublishers=Object.freeze({
 kuer:{name:'KUER 90.1',hosts:['www.kuer.org','kuer.org'],credibility:3},
 ksl:{name:'KSL.com',hosts:['www.ksl.com','ksl.com'],credibility:3},
 kpcw:{name:'KPCW',hosts:['www.kpcw.org','kpcw.org'],credibility:3},
 tribune:{name:'The Salt Lake Tribune',hosts:['www.sltrib.com','sltrib.com'],credibility:3},
 standard:{name:'Standard-Examiner',hosts:['www.standard.net','standard.net'],credibility:3},
 fox13:{name:'FOX 13 Utah',hosts:['www.fox13now.com','fox13now.com'],credibility:3},
 nps:{name:'National Park Service',hosts:['www.nps.gov','nps.gov'],credibility:4},
 parks:{name:'Utah State Parks',hosts:['stateparks.utah.gov'],credibility:4},
 ogden:{name:'Ogden City pipeline project',hosts:['ogdencitypipeline.com'],credibility:4},
 nmma:{name:'National Marine Manufacturers Association',hosts:['www.nmma.org','nmma.org'],credibility:3},
});
const editorialDay=86400000;
function editorialTime(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v))return NaN;return Date.parse(v);}
function trustedEditorialURL(value,publisher){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&publisher.hosts.includes(u.hostname);}catch{return false;}}
export function assessEditorial(item,lakeId,now=Date.now()){
 if(!item||item.reviewStatus!=='verified')return 'unverified';
 if(!Array.isArray(item.lakeIds)||!item.lakeIds.includes(lakeId))return 'wrong-lake';
 const publisher=intelPublishers[item.publisher];if(!publisher||!trustedEditorialURL(item.url,publisher))return 'untrusted-source';
 if(item.corroborationURL){let safe=false;try{const u=new URL(item.corroborationURL);safe=u.protocol==='https:'&&!u.username&&!u.password&&(Object.values(intelPublishers).some(p=>p.hosts.includes(u.hostname))||u.hostname.endsWith('.utah.gov'));}catch{}if(!safe)return 'untrusted-corroboration';}
 if(!['Access','Water Quality','Safety','Lake Operations','Boating Law'].includes(item.category)||!['launch-access','navigation','water-contact','water-level','operator-requirement'].includes(item.boatingImpact))return 'not-actionable';
 if(['housing','tourism','fishing','history','general-weather'].includes(item.topic))return 'excluded-topic';
 if(!item.id||!item.eventId||!item.title||!item.summary||!item.impactEvidence)return 'missing-evidence';
 const reviewed=editorialTime(item.reviewedAt),until=editorialTime(item.reviewUntil);
 if(!Number.isFinite(reviewed)||!Number.isFinite(until)||reviewed>now||until<=now||until-reviewed>2*editorialDay||now-reviewed>2*editorialDay)return 'review-expired';
 const expiry=item.effectiveUntil?editorialTime(item.effectiveUntil):null;if(expiry!==null&&(!Number.isFinite(expiry)||expiry<=now))return 'event-expired';
 const published=item.publishedAt?editorialTime(item.publishedAt):null,updated=item.updatedAt?editorialTime(item.updatedAt):null;
 if((published!==null&&(!Number.isFinite(published)||published>now))||(updated!==null&&(!Number.isFinite(updated)||updated>now)))return 'invalid-date';
 if(item.category==='Boating Law'){
  const effective=editorialTime(item.effectiveAt);if(!Number.isFinite(effective)||!item.corroborationURL)return 'unverified-law';
  if(now<effective-30*editorialDay||now>effective+14*editorialDay)return 'outside-law-window';
 }else{
  const date=updated??published;
  const days=item.category==='Safety'?2:item.category==='Access'?14:30;
  const ongoing=item.applicability==='ongoing'&&item.corroborationURL&&item.ongoingEvidence;
  if((date===null||now-date>days*editorialDay)&&!ongoing)return 'stale-or-undated';
 }
 if(item.severity&&!['notice','watch','warning','danger','closure'].includes(item.severity))return 'invalid-severity';
 if(item.severity&&item.severity!=='notice'&&!item.severityEvidence)return 'unsupported-severity';
 return null;
}
export function selectEditorial(feed,lakeId,now=Date.now()){
 if(feed?.schemaVersion!==1||!Array.isArray(feed.items)||!feed.reviews||typeof feed.reviews!=='object')throw Error('Malformed reviewed bulletin.');
 const review=feed.reviews[lakeId],checked=review?editorialTime(review.checkedAt):NaN;
 const deadline=review?.reviewUntil?editorialTime(review.reviewUntil):checked+2*editorialDay;
 let available=Number.isFinite(checked)&&Number.isFinite(deadline)&&deadline>now&&checked<=now&&now-checked<2*editorialDay;
 const rejected=[],groups=new Map();
 for(const item of feed.items){const reason=assessEditorial(item,lakeId,now);if(reason){if(reason!=='wrong-lake')rejected.push({id:item?.id,reason});if(reason==='review-expired'&&item?.lakeIds?.includes(lakeId))available=false;continue;}
  const p=intelPublishers[item.publisher],severity={notice:0,watch:1,warning:2,closure:3,danger:3}[item.severity||'notice'];
  const normalized={...item,kind:'editorial',lakeId,source:p.name,sourceCredibility:p.credibility,severity,relevance:item.scope==='statewide'?1:2,impact:item.boatingImpact==='launch-access'?3:2,monitoredAt:Date.parse(item.updatedAt||item.publishedAt||item.reviewedAt),sites:[],label:item.severity&&item.severity!=='notice'?item.severity:'Reviewed report'};
  const prior=groups.get(item.eventId);if(!prior||normalized.sourceCredibility>prior.sourceCredibility||normalized.sourceCredibility===prior.sourceCredibility&&normalized.monitoredAt>prior.monitoredAt)groups.set(item.eventId,normalized);
 }
 return {items:available?[...groups.values()]:[],available,checkedAt:available?checked:null,rejected,candidateCount:review?.candidateCount??0,scope:review?.scope||'No editorial review recorded for this lake.'};
}
export function rankLakeIntel(items){const seen=new Set();return [...items].sort((a,b)=>(b.relevance??2)-(a.relevance??2)||(b.impact??2)-(a.impact??2)||b.severity-a.severity||b.monitoredAt-a.monitoredAt||(b.sourceCredibility??4)-(a.sourceCredibility??4)).filter(i=>{const event=i.eventId||i.id;if(seen.has(event))return false;seen.add(event);return true;}).slice(0,5);}
export function createEditorialClient({fetcher=(...args)=>fetch(...args),clock=()=>Date.now(),timeoutMs=6000,ttl=15*60*1000}={}){
 let cache=null,pending=null;
 return {load(lakeId,{fresh=false}={}){
  const now=clock();if(!fresh&&cache&&now-cache.at<ttl)return Promise.resolve(selectEditorial(cache.feed,lakeId,now));
  if(pending)return pending.then(feed=>selectEditorial(feed,lakeId,clock()));
  let timer;const controller=new AbortController();
  pending=Promise.race([(async()=>{const r=await fetcher('data/lake-intel-bulletin.json',{signal:controller.signal,cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('Bulletin unavailable.');const f=await r.json();selectEditorial(f,lakeId,clock());return f;})(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Bulletin timed out.'));},timeoutMs);})]).then(feed=>{cache={feed,at:clock()};return feed;}).finally(()=>{clearTimeout(timer);pending=null;});
  return pending.then(feed=>selectEditorial(feed,lakeId,clock()));
 }};
}
export function createCombinedIntelClient(waterClient,editorialClient){return {async load(lakeId,options){const [w,n]=await Promise.allSettled([waterClient.load(lakeId,options),editorialClient.load(lakeId,options)]);const water=w.status==='fulfilled'?w.value:null,news=n.status==='fulfilled'?n.value:null;const items=rankLakeIntel([...(water?.items||[]),...(news?.items||[])]);return {items,status:items.length?'items':water?.status==='empty'&&news?.available?'empty':'unavailable',checkedAt:water?.checkedAt??Date.now(),waterCheckedAt:water?.checkedAt??null,editorialCheckedAt:news?.checkedAt??null,editorialScope:news?.scope,partial:!water||water.partial||!news?.available,waterUnavailable:!water||water.status==='unavailable',editorialUnavailable:!news?.available,uncertain:water?.uncertain??0};}};}
