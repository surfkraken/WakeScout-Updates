// Presentation interactions only. Forecast calculations live in the existing engine.
const mainNav=document.querySelector('nav[aria-label="Main navigation"]');
const moveToPlanner=()=>document.querySelector('#launch-pad').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
const switchMode=mode=>{const button=mainNav.querySelector(`[data-mode="${mode}"]`);if(button&&!button.disabled){button.click();if(mode!=='about')moveToPlanner();else window.scrollTo({top:0,behavior:'auto'});}};
document.querySelectorAll('[data-ui-mode]').forEach(button=>button.addEventListener('click',()=>switchMode(button.dataset.uiMode)));
document.querySelectorAll('[data-ui-topic]').forEach(button=>button.addEventListener('click',()=>{switchMode('about');document.querySelector('#topic-'+button.dataset.uiTopic)?.click();}));
document.querySelectorAll('[data-ui-lake]').forEach(button=>button.addEventListener('click',()=>{if(mainNav.querySelector('[data-mode="window"]').disabled)return;switchMode('window');const lake=document.querySelector('#lake');if([...lake.options].some(o=>o.value===button.dataset.uiLake)){lake.value=button.dataset.uiLake;lake.dispatchEvent(new Event('change'));lake.focus({preventScroll:true});}}));
const syncMode=()=>{const mode=mainNav.querySelector('[aria-current="page"]')?.dataset.mode;document.querySelectorAll('.mode-switch button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.uiMode===mode)));document.querySelector('#planner').classList.toggle('shootout-mode',mode==='shootout');};
new MutationObserver(syncMode).observe(mainNav,{subtree:true,attributes:true,attributeFilter:['aria-current']});syncMode();
const results=document.querySelector('#results');let shown=null;
new MutationObserver(()=>{const report=results.querySelector('.recommendation');const status=document.querySelector('#status');const has=!!report;document.querySelector('#planner').classList.toggle('has-report',has);if(has&&report!==shown){shown=report;document.querySelector('.results-area').scrollIntoView({block:'start',behavior:'auto'});}else if(!has)shown=null;}).observe(results,{childList:true});
