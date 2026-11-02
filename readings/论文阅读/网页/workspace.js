/* One root document owns favorites and Markdown ideas, including file:// use. */
(() => {
  'use strict';
  const markdownFactory = typeof module !== 'undefined' && module.exports
    ? require('./vendor/markdown-it-15.0.3.min.js') : globalThis.markdownit;
  const markdownRenderer = markdownFactory({html:false,linkify:false});
  // Remote image loading is unnecessary for text ideas; keep image labels as text.
  markdownRenderer.disable('image');
  function renderIdeaMarkdown(text, inline = false) {
    return inline ? markdownRenderer.renderInline(text) : markdownRenderer.render(text);
  }
  const newId = () => globalThis.crypto?.randomUUID?.() || 'idea-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  function validateWorkspace(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.favorites) || !Array.isArray(value.ideas)) throw new Error('备份格式或版本不受支持');
    if (value.favorites.some(p => typeof p !== 'string' || !/^P\d+$/.test(p))) throw new Error('收藏编号格式无效');
    const seen = new Set();
    const ideas = value.ideas.map(idea => {
      if (!idea || typeof idea.id !== 'string' || !idea.id || idea.id.length > 160 || seen.has(idea.id) ||
          typeof idea.markdown !== 'string' || typeof idea.createdAt !== 'string' || typeof idea.updatedAt !== 'string' ||
          Number.isNaN(Date.parse(idea.createdAt)) || Number.isNaN(Date.parse(idea.updatedAt))) throw new Error('点子数据不完整或编号重复');
      seen.add(idea.id);
      return {id:idea.id,markdown:idea.markdown,createdAt:idea.createdAt,updatedAt:idea.updatedAt};
    });
    const clean = {version:1,favorites:[...new Set(value.favorites)],ideas};
    if (typeof value.recoveryRaw === 'string') clean.recoveryRaw = value.recoveryRaw;
    return clean;
  }
  function mergeWorkspace(current, incoming) {
    const a = validateWorkspace(current), b = validateWorkspace(incoming);
    const ideas = [...a.ideas];
    for (const idea of b.ideas) {
      const old = ideas.find(i => i.id === idea.id);
      if (!old) ideas.push(idea);
      else if (old.markdown !== idea.markdown && !ideas.some(i => i.markdown === idea.markdown && i.createdAt === idea.createdAt)) ideas.push({...idea,id:newId()});
    }
    const merged={...a,favorites:[...new Set([...a.favorites,...b.favorites])],ideas};
    const recovery=[...new Set([a.recoveryRaw,b.recoveryRaw].filter(value=>typeof value==='string'))];
    if(recovery.length)merged.recoveryRaw=recovery.length===1?recovery[0]:JSON.stringify(recovery);
    return merged;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {validateWorkspace,mergeWorkspace,renderIdeaMarkdown};
  if (typeof document === 'undefined') return;

  const data = JSON.parse(document.getElementById('hub-data').textContent);
  const $ = id => document.getElementById(id);
  const key = 'paper-reading-workspace-v1';
  const empty = () => ({version:1,favorites:[],ideas:[]});
  let state = empty(), blockedStorage = false;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {state = validateWorkspace(JSON.parse(raw));}
      catch (_) {state.recoveryRaw = raw; blockedStorage = true;}
    }
  } catch (_) {blockedStorage = true;}
  function status(text) {$('workspace-status').textContent = text;}
  function save(message='已自动保存到当前浏览器。建议定期导出备份。') {
    try {
      if (blockedStorage) throw new Error('存储不可用或需恢复');
      localStorage.setItem(key, JSON.stringify(state)); status(message); return true;
    } catch (_) {status('浏览器保存不可用或原数据异常：内容暂存在本页，请导出备份；刷新可能丢失本次修改。');return false;}
  }
  if (blockedStorage) status('本地存储不可用或数据异常。原始值保留在备份中，新内容请及时导出，勿直接刷新。');
  const paper = pid => data.papers.find(p => p.pid === pid);
  const theme = id => data.themes.find(t => t.id === id);
  const iconRoot = 'readings/论文阅读/网页/';
  const frame = $('reading-frame');
  const messageOrigin=location.protocol==='file:'?'null':location.origin;
  const parentOrigin=location.protocol==='file:'?'*':location.origin;
  let readerReady=false, readerToken='';
  function publish() {
    if (readerReady && frame.contentWindow) frame.contentWindow.postMessage({type:'paper-workspace-state',token:readerToken,favorites:state.favorites,dark:document.body.classList.contains('dark')}, parentOrigin);
  }
  function favoriteButton(pid) {
    const button = document.createElement('button'); button.type='button';button.className='favorite-toggle';button.dataset.pid=pid;
    const on = state.favorites.includes(pid), label = on ? '取消收藏 '+pid : '收藏 '+pid;
    button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',label);button.title=label;
    const img = document.createElement('img');img.src=iconRoot+(on?'favorite-filled.svg':'favorite-outline.svg');img.alt='';img.width=24;img.height=24;
    button.append(img);button.onclick=()=>toggleFavorite(pid);return button;
  }
  function paperCard(p) {
    const card=document.createElement('article');card.className='paper-card';card.dataset.pid=p.pid;
    const head=document.createElement('div');head.className='section-heading';
    const identity=document.createElement('span');identity.className='muted';identity.textContent=p.pid+' · '+theme(p.theme).name;
    head.append(identity,favoriteButton(p.pid));
    const heading=document.createElement('h2'), link=document.createElement('a');link.href='#paper='+p.pid;link.textContent=p.title;heading.append(link);
    const meta=document.createElement('p');meta.className='muted';meta.textContent=p.status+' · '+p.questions+'组编号问答';
    const stop=document.createElement('p');stop.className='card-excerpt';stop.textContent=p.stop || '阅读范围与停点请查看本篇记录。';
    const action=document.createElement('a');action.className='card-read';action.href=link.href;action.textContent='打开阅读 →';
    card.append(head,heading,meta,stop,action);return card;
  }
  function renderPapers() {
    const filter=$('theme-filter').value;
    $('theme-papers').replaceChildren(...data.papers.filter(p=>!filter||p.theme===filter).map(paperCard));
    const favorites=data.papers.filter(p=>state.favorites.includes(p.pid));
    $('favorite-papers').replaceChildren(...favorites.map(paperCard));
    const unknown=state.favorites.filter(pid=>!paper(pid));
    $('favorites-count').textContent=favorites.length+'篇已收藏'+(unknown.length?` · ${unknown.length}个编号暂不在当前目录，备份中仍保留`:'');
    if (!favorites.length) {
      const p=document.createElement('p');p.className='empty-state';p.textContent='还没有收藏论文。到主题或阅读正文中点亮星标，即可在这里找到。';$('favorite-papers').append(p);
    }
  }
  function toggleFavorite(pid) {
    if (!paper(pid)) return;
    state.favorites=state.favorites.includes(pid)?state.favorites.filter(id=>id!==pid):[...state.favorites,pid];
    save(state.favorites.includes(pid)?'已收藏到当前浏览器。':'已取消收藏。');renderPapers();publish();
  }
  function ideaTitle(markdown) {
    return (markdown.match(/^#{1,6}\s+(.+)$/m)?.[1] || markdown.split('\n').find(s=>s.trim()) || '未命名点子').trim().slice(0,100);
  }
  function excerpt(markdown) {return markdown.replace(/^#{1,6}\s+.+\n?/m,'').replace(/\s+/g,' ').trim().slice(0,140) || '点击展开，写下问题、证据或新的想法。';}
  function download(text,name,type) {
    const url=URL.createObjectURL(new Blob(['\ufeff'+text],{type:type+';charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function renderIdeas(openId, editing = false) {
    $('idea-cards').replaceChildren();
    if (!state.ideas.length) {
      const p=document.createElement('p');p.className='empty-state';p.textContent='还没有点子。新建一张卡片，或导入已有的 Markdown。';$('idea-cards').append(p);
    }
    for (const idea of [...state.ideas].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))) {
      const card=document.createElement('details');card.className='idea-card';card.dataset.ideaId=idea.id;card.open=idea.id===openId;
      const summary=document.createElement('summary');
      const title=document.createElement('h2');title.textContent=ideaTitle(idea.markdown);
      const description=document.createElement('p');description.className='card-excerpt';description.innerHTML=renderIdeaMarkdown(excerpt(idea.markdown),true);
      const stamp=document.createElement('small');stamp.className='muted';
      const updateStamp=()=>{stamp.textContent='编辑于 '+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(idea.updatedAt));};updateStamp();
      summary.append(title,description,stamp);
      const editor=document.createElement('div');editor.className='idea-editor';
      const preview=document.createElement('div');preview.className='idea-preview';
      const paintPreview=()=>{
        preview.innerHTML=renderIdeaMarkdown(idea.markdown);
        preview.querySelectorAll('a').forEach(a=>{a.target='_blank';a.rel='noopener noreferrer';});
      };
      paintPreview();
      const source=document.createElement('div');source.className='idea-source';
      const label=document.createElement('label');label.textContent='Markdown 正文';label.htmlFor='idea-'+idea.id;
      const input=document.createElement('textarea');input.id=label.htmlFor;input.className='markdown-editor';input.value=idea.markdown;input.rows=14;input.spellcheck=false;
      input.addEventListener('input',()=>{idea.markdown=input.value;idea.updatedAt=new Date().toISOString();title.textContent=ideaTitle(idea.markdown);description.innerHTML=renderIdeaMarkdown(excerpt(idea.markdown),true);updateStamp();save();});
      const controls=document.createElement('div');controls.className='view-actions';
      const toggle=document.createElement('button');toggle.type='button';
      let isEditing=card.open&&editing;
      const updateMode=()=>{source.hidden=!isEditing;preview.hidden=isEditing;toggle.textContent=isEditing?'预览':'编辑 Markdown';toggle.setAttribute('aria-expanded',String(isEditing));};
      toggle.onclick=()=>{isEditing=!isEditing;if(!isEditing)paintPreview();updateMode();if(isEditing)input.focus();};
      updateMode();
      const exportButton=document.createElement('button');exportButton.type='button';exportButton.textContent='导出 .md';
      exportButton.onclick=()=>download(idea.markdown,ideaTitle(idea.markdown).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')+'.md','text/markdown');
      const close=document.createElement('button');close.type='button';close.textContent='收起';close.onclick=()=>{card.open=false;summary.focus();};
      source.append(label,input);controls.append(toggle,exportButton,close);editor.append(preview,source,controls);card.append(summary,editor);$('idea-cards').append(card);
      if (card.open&&isEditing) input.focus();
    }
  }
  $('new-idea').onclick=()=>{
    const now=new Date().toISOString(),idea={id:newId(),markdown:'# 新点子\n\n',createdAt:now,updatedAt:now};
    state.ideas.unshift(idea);save('已创建点子，编辑会自动保存。');renderIdeas(idea.id,true);
    const input=$('idea-'+idea.id);input.focus();input.setSelectionRange(2,5);
  };
  async function fileText(file) {return (await file.text()).replace(/^\ufeff/,'');}
  $('import-markdown').onchange=async event=>{
    try {
      const imported=[];
      for(const file of event.target.files) {const markdown=await fileText(file),now=new Date().toISOString();imported.push({id:newId(),markdown,createdAt:now,updatedAt:now});}
      state.ideas.unshift(...imported);save(`已导入${imported.length}个点子。`);renderIdeas(imported[0]?.id);
    } catch(error) {status('导入未完成：'+error.message);} finally {event.target.value='';}
  };
  $('export-workspace').onclick=()=>download(JSON.stringify(state,null,2),'论文收藏与点子备份.json','application/json');
  $('import-workspace').onchange=async event=>{
    try {
      const file=event.target.files[0];if(!file)return;
      const incoming=validateWorkspace(JSON.parse(await fileText(file)));
      state=mergeWorkspace(state,incoming);save('备份已合并；相同编号的不同正文保留为独立点子。');renderPapers();renderIdeas();publish();
    } catch(error) {status('备份未导入，现有内容已保留：'+error.message);} finally {event.target.value='';}
  };
  document.querySelectorAll('.file-button').forEach(label=>{
    label.tabIndex=0;label.setAttribute('role','button');
    label.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();label.querySelector('input').click();}};
  });
  data.themes.forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.name;$('theme-filter').append(o);});
  $('theme-filter').onchange=()=>{location.hash=$('theme-filter').value?'theme='+$('theme-filter').value:'themes';};
  function renderReproductions() {
    const host=$('reproduction-projects');if(host.dataset.rendered)return;host.dataset.rendered='true';host.replaceChildren();
    const experiments=document.createElement('iframe');experiments.title='实验卡片';experiments.src='experiments/index.html?embed=1';
    experiments.style.cssText='display:block;width:100%;height:650px;border:0;background:transparent';
    const syncTheme=()=>experiments.contentWindow?.postMessage({type:'experiment-theme',dark:document.body.classList.contains('dark')},parentOrigin);
    experiments.addEventListener('load',syncTheme);
    new MutationObserver(syncTheme).observe(document.body,{attributes:true,attributeFilter:['class']});
    window.addEventListener('message',event=>{
      if(event.source!==experiments.contentWindow||event.origin!==messageOrigin||event.data?.type!=='experiment-height')return;
      const height=Number(event.data.height);if(Number.isFinite(height))experiments.style.height=Math.max(520,Math.min(20000,height))+'px';
    });host.append(experiments);
  }
  function route() {
    let hash;
    try{hash=decodeURIComponent(location.hash.slice(1));}catch(_){hash='overview';}
    if(hash==='experiments')hash='reproductions';
    if(hash.startsWith('favorite=')) {
      const pid=hash.slice(9).toUpperCase();if(paper(pid))toggleFavorite(pid);
      history.replaceState(null,'','#paper='+pid);hash='paper='+pid;
    }
    let view=['overview','themes','favorites','ideas','reproductions'].includes(hash)?hash:'overview';
    if(hash.startsWith('theme=')){view='themes';$('theme-filter').value=theme(hash.slice(6))?hash.slice(6):'';}
    else if(view==='themes')$('theme-filter').value='';
    if(hash.startsWith('paper=')&&paper(hash.slice(6).toUpperCase())) {
      view='paper';const p=paper(hash.slice(6).toUpperCase());
      if(frame.dataset.pid!==p.pid){
        frame.dataset.pid=p.pid;readerReady=false;readerToken=newId();
        const url=new URL(p.url,location.href);url.searchParams.set('desk',readerToken);frame.src=url.href;
      }
    }
    for(const section of document.querySelectorAll('.app-view'))section.hidden=section.id!=='view-'+view;
    document.querySelectorAll('.workspace-nav a').forEach(a=>{const active=a.dataset.view===(view==='paper'?'themes':view);a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    document.body.classList.toggle('reading-route',view==='paper');$('workspace-tools').hidden=view==='reproductions';
    if(view==='themes'||view==='favorites')renderPapers();
    if(view==='ideas'&&!$('idea-cards').childElementCount)renderIdeas();
    if(view==='reproductions')renderReproductions();
    document.title=({overview:'阅读总览',themes:'主题',favorites:'收藏',ideas:'点子',reproductions:'实验',paper:'论文阅读'}[view])+' · 论文阅读笔记';
    window.scrollTo(0,0);publish();
  }
  document.addEventListener('click',event=>{
    const a=event.target.closest('a[href]');if(!a||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||a.target==='_blank')return;
    const url=new URL(a.href,location.href);
    const t=data.themes.find(t=>new URL(t.url,location.href).pathname===url.pathname);
    if(t){event.preventDefault();const pid=url.hash.slice(1).toUpperCase();location.hash=paper(pid)?'paper='+pid:'theme='+t.id;}
  });
  $('hub-search').addEventListener('input',()=>{if($('hub-search').value.trim()&&location.hash!=='#overview')location.hash='overview';});
  frame.addEventListener('load',()=>{
    readerReady=false;
    frame.contentWindow?.postMessage({type:'paper-workspace-request-ready'},parentOrigin);
  });
  window.addEventListener('message',event=>{
    if(event.source!==frame.contentWindow||event.origin!==messageOrigin||!event.data||typeof event.data!=='object'||event.data.token!==readerToken||!readerToken)return;
    const message=event.data;
    if(message.type==='paper-workspace-ready'){readerReady=true;publish();return;}
    if(!readerReady)return;
    if(message.type==='paper-toggle-favorite'&&paper(message.pid))toggleFavorite(message.pid);
    if(message.type==='paper-route'&&typeof message.route==='string'&&/^(overview|themes|favorites|ideas|reproductions|experiments|theme=[a-z]+|paper=P\d+)$/.test(message.route))location.hash=message.route;
    if(message.type==='paper-selected'&&paper(message.pid)) {frame.dataset.pid=message.pid;history.replaceState(null,'','#paper='+message.pid);}
    if(message.type==='paper-theme'&&typeof message.dark==='boolean'&&document.body.classList.contains('dark')!==message.dark)$('theme').click();
  });
  new MutationObserver(publish).observe(document.body,{attributes:true,attributeFilter:['class']});
  window.addEventListener('hashchange',route);
  window.addEventListener('storage',event=>{
    if(event.key!==key)return;
    blockedStorage=true;
    status('另一窗口更新了收藏或点子。为避免覆盖，本页暂不写入浏览器；请导出本页修改，刷新后可合并导入。');
  });
  renderPapers();route();
})();
