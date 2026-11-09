// Automated coverage is a discovery aid, not a verified safety advisory.
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function selectCoverage(feed,lakeId,now=Date.now()){
 if(feed?.schemaVersion!==1||typeof feed.lakes!=='object')throw Error('Invalid coverage feed');
 const generated=Date.parse(feed.generatedAt);
 if(!Number.isFinite(generated)||generated>now+3600000||now-generated>36*3600000)return {status:'unavailable',items:[]};
 const lake=feed.lakes[lakeId];
 if(!lake||lake.status!=='ok')return {status:'unavailable',items:[]};
 const items=(Array.isArray(lake.items)?lake.items:[]).filter(x=>{
  try{const u=new URL(x.url),d=Date.parse(x.publishedAt);return u.protocol==='https:'&&['news.google.com','www.google.com'].includes(u.hostname)&&Number.isFinite(d)&&d<=now+3600000&&now-d<=14*86400000&&typeof x.title==='string'&&x.title.length<=220;}catch{return false;}
 }).slice(0,5);
 return {status:items.length?'items':'empty',items,generatedAt:generated};
}
export async function mountCoverage(host,lakeId,{fetcher=fetch}={}){
 const section=document.createElement('section');section.className='intel-coverage-feed';
 section.style.cssText='margin-top:24px;padding:20px;border:1px solid #cbddec;border-radius:12px;background:#f4faff';
 section.innerHTML='<h3>Latest lake coverage</h3><p>Loading recent lake-specific headlines…</p>';
 host.append(section);
 try{
  const response=await fetcher('data/lake-intel-coverage.json',{cache:'no-store'});
  if(!response.ok)throw Error('Coverage unavailable');
  const data=selectCoverage(await response.json(),lakeId);
  if(!section.isConnected)return;
  const note='<p style="font-size:.85rem">Automated headlines, not independently verified. Confirm details and current access with the original publisher and official lake operator.</p>';
  if(data.status==='unavailable'){section.innerHTML='<h3>Latest lake coverage</h3><p>Recent coverage could not be checked. This is not an all-clear.</p>';return;}
  if(data.status==='empty'){section.innerHTML='<h3>Latest lake coverage</h3><p>No relevant headlines found in the last 14 days.</p>'+note;return;}
  section.innerHTML='<h3>Latest lake coverage</h3>'+note+'<ul style="padding-left:20px">'+data.items.map(i=>'<li style="margin:12px 0"><a href="'+safe(i.url)+'" target="_blank" rel="noopener noreferrer">'+safe(i.title)+'</a><div style="font-size:.8rem">'+safe(i.publisher)+' · '+safe(new Date(i.publishedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}))+'</div></li>').join('')+'</ul>';
 }catch{if(section.isConnected)section.innerHTML='<h3>Latest lake coverage</h3><p>News coverage is temporarily unavailable. Check official lake sources.</p>';}
}
