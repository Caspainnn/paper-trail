/* The parent reading desk owns favorites; standalone legacy pages remain usable. */
(() => {
  const embedded = window.parent !== window;
  const token = new URL(location.href).searchParams.get('desk') || '';
  const messageOrigin = location.protocol === 'file:' ? 'null' : location.origin;
  const parentOrigin = location.protocol === 'file:' ? '*' : location.origin;
  if (embedded) document.body.classList.add('embedded-reader');
  const send = message => {if (embedded) window.parent.postMessage({...message,token},parentOrigin);};
  document.querySelectorAll('.favorite-toggle[data-pid]').forEach(button => {
    button.onclick = () => {
      if (embedded) send({type:'paper-toggle-favorite',pid:button.dataset.pid});
      else location.href = '../../index.html#favorite='+button.dataset.pid;
    };
  });
  window.addEventListener('message',event=>{
    if (!embedded || event.source !== window.parent || event.origin !== messageOrigin) return;
    if(event.data?.type==='paper-workspace-request-ready'){send({type:'paper-workspace-ready'});return;}
    if (event.data?.type !== 'paper-workspace-state' || event.data.token !== token || !Array.isArray(event.data.favorites)) return;
    document.querySelectorAll('.favorite-toggle[data-pid]').forEach(button=>{
      const on=event.data.favorites.includes(button.dataset.pid),label=(on?'取消收藏 ':'收藏 ')+button.dataset.pid;
      button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',label);button.title=label;
      button.querySelector('img').src='网页/'+(on?'favorite-filled.svg':'favorite-outline.svg');
    });
    if(typeof event.data.dark==='boolean')theme(event.data.dark);
  });
  let reported='';
  const notify = () => {const p=document.querySelector('.paper:not([hidden])');if(p&&p.id!==reported){reported=p.id;send({type:'paper-selected',pid:p.id.toUpperCase()});}};
  document.querySelectorAll('.paper-link').forEach(a=>a.addEventListener('click',notify));
  window.addEventListener('hashchange',notify);
  if(embedded){
    const observer=new MutationObserver(notify);
    document.querySelectorAll('.paper').forEach(p=>observer.observe(p,{attributes:true,attributeFilter:['hidden']}));
    document.addEventListener('click',event=>{
      const a=event.target.closest('a[href]');if(!a)return;
      const url=new URL(a.href,location.href);
      if(url.pathname!==location.pathname||url.origin!==location.origin){a.target='_blank';a.rel='noopener noreferrer';}
    },true);
    const select=document.getElementById('topic-nav');
    if(select)select.onchange=()=>send({type:'paper-route',route:'theme='+select.selectedOptions[0].dataset.theme});
    document.getElementById('theme').addEventListener('click',()=>send({type:'paper-theme',dark:document.body.classList.contains('dark')}));
    send({type:'paper-workspace-ready'});notify();
  }
})();
