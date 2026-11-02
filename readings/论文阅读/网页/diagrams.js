// Share the fullscreen control with the field-map dialog. Dialog elements cannot
// themselves enter native fullscreen, so fullscreen the page and fill it with the dialog.
function addDiagramFullscreen(viewer, controls, resize = () => {}) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'diagram-fullscreen-toggle';
  button.textContent = '全屏'; button.setAttribute('aria-pressed', 'false');
  const status = document.createElement('span');
  status.setAttribute('role', 'status'); status.hidden = true;
  controls.append(button, status);
  let owned = false;
  function update() {
    const active = owned && !!document.fullscreenElement;
    viewer.classList.toggle('diagram-fullscreen', active);
    button.textContent = active ? '退出全屏' : '全屏';
    button.setAttribute('aria-pressed', String(active));
    if (!document.fullscreenElement) owned = false;
    resize();
  }
  button.onclick = async () => {
    status.hidden = true;
    try {
      if (owned && document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        owned = true;
        await document.documentElement.requestFullscreen();
      }
      update();
    } catch (error) {
      owned = false; update();
      status.textContent = '浏览器未允许全屏，请检查浏览器权限。'; status.hidden = false;
    }
  };
  document.addEventListener('fullscreenchange', update);
  viewer.addEventListener('close', () => {
    if (owned && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    owned = false; update();
  });
}

// Source stays in Markdown. Render only the visible paper to preserve SVG measurements.
let graphQueue=Promise.resolve(), graphSerial=0;
function scheduleDiagrams(){graphQueue=graphQueue.then(async()=>{
  const dark=document.body.classList.contains('dark');
  for(const figure of document.querySelectorAll('.paper:not([hidden]) .mermaid-figure')){
    const key=dark?'dark':'light';if(figure.dataset.theme===key)continue;
    const view=figure.querySelector('.diagram-view');if(!view)continue;
    try{
      if(!window.mermaid)throw new Error('Mermaid unavailable');
      mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'base',fontFamily:'Microsoft YaHei, Segoe UI, sans-serif',flowchart:{htmlLabels:false,useMaxWidth:true,curve:'basis'},themeVariables:{primaryColor:dark?'#303b2d':'#edf3e9',primaryTextColor:dark?'#e5e7dc':'#26332b',primaryBorderColor:dark?'#91aa82':'#729077',lineColor:dark?'#b2c7a1':'#28563b',clusterBkg:dark?'#252925':'#fafbf7',clusterBorder:dark?'#41493e':'#dce2d9',titleColor:dark?'#e5e7dc':'#26332b',edgeLabelBackground:dark?'#252925':'#fffefa',fontSize:'16px'}});
      const {svg}=await mermaid.render('reading-graph-'+(++graphSerial),figure.querySelector('code.language-mermaid').textContent);
      view.innerHTML=svg;
      view.querySelectorAll('.cluster-label text, .cluster-label span, .cluster-label p').forEach(label=>{
        label.style.fontSize='20px';
        label.style.fontWeight='700';
      });
      // With htmlLabels disabled, bold the SVG name line instead of HTML tags.
      view.querySelectorAll('.node.model, .node.tool, .node.entity').forEach(node=>{
        const name=node.querySelector('text > tspan');
        if(name) name.style.fontWeight='700';
      });
      figure.dataset.theme=key;
    }catch(error){view.textContent='流程图未能加载，请展开下方源码阅读。';figure.querySelector('details').open=true;console.error(error)}
  }
}).catch(console.error)}
new MutationObserver(scheduleDiagrams).observe(document.body,{attributes:true,attributeFilter:['class']});
document.querySelectorAll('.paper').forEach(p=>new MutationObserver(scheduleDiagrams).observe(p,{attributes:true,attributeFilter:['hidden']}));
const dialog=document.querySelector('#diagram-dialog');let originalFigure=null;
const graphViewport=document.querySelector('#diagram-large');
const graphControls=imageDialog.querySelector('.image-controls').cloneNode(true);
graphControls.className='diagram-controls';dialog.append(graphControls);
addDiagramFullscreen(dialog, graphControls);
const graphClose=document.querySelector('#diagram-close');
graphClose.innerHTML=imageDialog.querySelector('.image-close').innerHTML;
graphClose.setAttribute('aria-label','关闭流程图');graphClose.title='关闭流程图';
const graphMinus=graphControls.querySelector('.image-minus'),graphPlus=graphControls.querySelector('.image-plus');
graphMinus.setAttribute('aria-label','缩小流程图');graphMinus.title='缩小流程图';
graphPlus.setAttribute('aria-label','放大流程图');graphPlus.title='放大流程图';
let graphScale=1,graphWidth=0,graphHeight=0,graphDrag=null;
function setGraphScale(scale){
  graphScale=Math.max(.25,Math.min(4,Math.round(scale*100)/100));
  const svg=graphViewport.querySelector('svg');if(!svg)return;
  svg.style.width=graphWidth*graphScale+'px';svg.style.height=graphHeight*graphScale+'px';
  graphControls.querySelector('output').textContent=Math.round(graphScale*100)+'%';
  graphMinus.disabled=graphScale<=.25;graphPlus.disabled=graphScale>=4;
}
graphMinus.onclick=()=>setGraphScale(graphScale/1.25);
graphPlus.onclick=()=>setGraphScale(graphScale*1.25);
graphViewport.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('a'))return;
  graphDrag={id:e.pointerId,x:e.clientX,y:e.clientY,left:graphViewport.scrollLeft,top:graphViewport.scrollTop};
  graphViewport.setPointerCapture(e.pointerId);graphViewport.classList.add('dragging');e.preventDefault();
});
graphViewport.addEventListener('pointermove',e=>{
  if(!graphDrag||graphDrag.id!==e.pointerId)return;
  graphViewport.scrollLeft=graphDrag.left+graphDrag.x-e.clientX;
  graphViewport.scrollTop=graphDrag.top+graphDrag.y-e.clientY;
});
function endGraphDrag(){graphDrag=null;graphViewport.classList.remove('dragging')}
graphViewport.addEventListener('pointerup',endGraphDrag);
graphViewport.addEventListener('pointercancel',endGraphDrag);
graphViewport.addEventListener('lostpointercapture',endGraphDrag);
document.querySelectorAll('.diagram-expand').forEach(b=>b.onclick=()=>{
  originalFigure=b.closest('figure');const view=originalFigure.querySelector('.diagram-view');
  graphViewport.append(view);dialog.showModal();
  const svg=view.querySelector('svg');
  if(svg){const box=svg.viewBox.baseVal;graphWidth=box.width||svg.getBoundingClientRect().width;graphHeight=box.height||svg.getBoundingClientRect().height;
    const fit=Math.min(1,(graphViewport.clientWidth-24)/graphWidth,(graphViewport.clientHeight-24)/graphHeight);
    graphWidth*=fit;graphHeight*=fit;setGraphScale(1);graphViewport.scrollTo(0,0);
  }
});
document.querySelector('#diagram-close').onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
dialog.addEventListener('close',()=>{endGraphDrag();if(originalFigure){const view=graphViewport.querySelector('.diagram-view');const svg=view.querySelector('svg');if(svg){svg.style.removeProperty('width');svg.style.removeProperty('height')}originalFigure.prepend(view);originalFigure=null;scheduleDiagrams()}});
scheduleDiagrams();
