import {validateDate} from './engine.js';
export const shareDisclosure='Report text and image are snapshots. Shared links retrieve the latest available forecast (up to 10 minutes cached), which may differ.';
export function activeReport(results,id){return results.find(r=>r.lake.id===id)||results[0];}
export function sharedPlan(params,lakes){
 const ids=(params.get('lakes')||'').split(',');
 if(ids.some(id=>!lakes.some(l=>l.id===id)))throw new Error('This shared link contains an invalid lake ID. Choose a lake to make a new report.');
 if(params.has('report')&&!ids.includes(params.get('report')))throw new Error('This shared link contains an invalid report lake.');
 validateDate(params.get('date'));
 return {ids,date:params.get('date'),mode:params.get('mode')==='shootout'?'shootout':'window',activeId:params.get('report')};
}
export async function deliverShare(platform,payload,manual){
 if(platform.share){try{await platform.share(payload);return 'shared';}catch(e){if(e.name==='AbortError')return 'cancelled';}}
 const text=payload.text+'\n'+payload.url;
 if(platform.clipboard){try{await platform.clipboard.writeText(text);return 'copied';}catch{}}
 manual(text);return 'manual';
}
