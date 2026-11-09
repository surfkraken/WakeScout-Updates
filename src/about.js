// Independent topic navigation. It never fetches data or changes forecast state.
export function initAboutBrowser(root=document){
 const browser=root.querySelector('[data-about-browser]');if(!browser)return;
 const tabs=[...browser.querySelectorAll('[data-about-topic]')];
 const panels=[...browser.querySelectorAll('.about-topic-panel')];
 const select=browser.querySelector('#about-topic-select');
 const choose=(key,{focus=false,scroll=false}={})=>{
  const tab=tabs.find(t=>t.dataset.aboutTopic===key);if(!tab)return;
  tabs.forEach(t=>{const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;});
  panels.forEach(p=>{p.hidden=p.id!==tab.getAttribute('aria-controls');});
  select.value=key;
  if(focus)tab.focus();
  if(scroll){const content=browser.querySelector('.about-content');if(content.getBoundingClientRect().top<0)browser.scrollIntoView({block:'start',behavior:'auto'});}
 };
 tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>choose(tab.dataset.aboutTopic,{scroll:true}));
  tab.addEventListener('keydown',event=>{
   let next;if(event.key==='ArrowDown')next=(index+1)%tabs.length;
   else if(event.key==='ArrowUp')next=(index-1+tabs.length)%tabs.length;
   else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;
   else return;
   event.preventDefault();choose(tabs[next].dataset.aboutTopic,{focus:true,scroll:true});
  });
 });
 select.addEventListener('change',()=>choose(select.value,{scroll:true}));
 // Preserve the original section anchors for saved links and browser history.
 const followHash=()=>{const id=location.hash.slice(1);if(!id.startsWith('about-'))return;const article=panels.find(p=>[...p.querySelectorAll('article[id]')].some(a=>a.id===id));if(article){choose(tabs.find(t=>t.getAttribute('aria-controls')===article.id).dataset.aboutTopic);root.querySelector('button[data-mode="about"]')?.click();}};
 window.addEventListener('hashchange',followHash);followHash();
 return {choose};
}
if(typeof document!=='undefined')initAboutBrowser();
