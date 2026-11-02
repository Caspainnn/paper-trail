// Markdown owns content; Markmap owns layout and folding.
(() => {
  const maps = [];
  const palette = dark => dark
    ? ['#c4d2b6', '#99c8b5', '#a7bbda', '#d5bba0', '#c2b3d4', '#a5c7cd']
    : ['#456344', '#3d7160', '#4e668c', '#8b6848', '#766087', '#46747e'];
  function recolor(mm) {
    const colors = palette(document.body.classList.contains('dark'));
    mm.setOptions({color: node => {
      const branch = Number(node.state.path.split('.')[1]);
      const index = mm.state.data.children.findIndex(child => child.state.id === branch);
      return colors[Math.max(0, index) % colors.length];
    }});
    return mm.setData();
  }
  function fold(node, value, depth = 0) {
    node.payload = {...node.payload, fold: depth ? value : 0};
    (node.children || []).forEach(child => fold(child, value, depth + 1));
  }
  const initialized = new WeakSet();
  async function initializeFieldMaps(scope = document) {
  for (const figure of scope.querySelectorAll('.field-map')) {
    if (initialized.has(figure)) continue;
    initialized.add(figure);
    try {
      const svg = figure.querySelector('svg');
      const canvas = figure.querySelector('.field-map-canvas');
      const actions = figure.querySelector('.map-actions');
      const expand = actions.querySelector('button');
      const root = JSON.parse(figure.querySelector('.field-map-data').textContent);
      const mm = new markmap.Markmap(svg, {
        initialExpandLevel: Number(figure.dataset.initialExpandLevel ?? 2), maxWidth: 240, spacingHorizontal: 70,
        spacingVertical: 18, paddingX: 14,
        duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180,
        lineWidth: () => 1.5, zoom: true, pan: false, scrollForPan: false, autoFit: false,
      });
      const zoomFilter = mm.zoom.filter();
      mm.zoom.filter(event => event.type !== 'dblclick' && (event.type !== 'wheel' || !!svg.closest('.field-map-dialog[open]')) && zoomFilter(event));
      await mm.setData(root);
      mm.setOptions({initialExpandLevel: -1});
      await recolor(mm); maps.push(mm);
      const dialog = document.createElement('dialog');
      dialog.className = 'field-map-dialog';
      dialog.setAttribute('aria-label', '放大思维导图');
      const close = document.createElement('button');
      close.className = 'field-map-close'; close.type = 'button';
      close.setAttribute('aria-label', '关闭思维导图');
      const viewerTemplate = typeof imageDialog !== 'undefined' ? imageDialog : document.querySelector('#map-viewer-template').content;
      close.innerHTML = viewerTemplate.querySelector('.image-close').innerHTML;
      const controls = viewerTemplate.querySelector('.image-controls').cloneNode(true);
      controls.className = 'diagram-controls';
      dialog.append(close, controls); document.body.append(dialog);
      const minus = controls.querySelector('.image-minus');
      const plus = controls.querySelector('.image-plus');
      const output = controls.querySelector('output');
      minus.title = '缩小'; plus.title = '放大';
      minus.setAttribute('aria-label', '缩小思维导图');
      plus.setAttribute('aria-label', '放大思维导图');
      minus.onclick = () => mm.rescale(.8); plus.onclick = () => mm.rescale(1.25);
      mm.zoom.on('zoom.reading', event => {
        output.value = Math.round(event.transform.k * 100) + '%';
        minus.disabled = event.transform.k <= .05; plus.disabled = event.transform.k >= 8;
      });
      const fit = () => { if (canvas.getBoundingClientRect().width) return mm.fit(); };
      for (const [label, value] of [['适应画布', null], ['收起分支', 1], ['展开全部', 0]]) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'map-text-control'; button.textContent = label;
        button.onclick = async () => {
          if (value !== null) { fold(mm.state.data, value); await mm.setData(mm.state.data); }
          await fit();
        };
        controls.append(button);
      }
      addDiagramFullscreen(dialog, controls, fit);
      expand.onclick = async () => {
        dialog.insertBefore(canvas, controls); dialog.showModal(); close.focus(); await fit();
      };
      close.onclick = () => dialog.close();
      dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
      dialog.addEventListener('close', () => {
        figure.insertBefore(canvas, actions); expand.focus(); fit();
      });
      function keyboardNodes() {
        svg.querySelectorAll('.markmap-node circle').forEach(circle => {
          const datum = d3.select(circle).datum();
          if (!datum.children?.length) return;
          circle.setAttribute('tabindex', '0'); circle.setAttribute('role', 'button');
          const label = new DOMParser().parseFromString(datum.content, 'text/html').body.textContent;
          circle.setAttribute('aria-label', '展开或收起：' + label);
          circle.setAttribute('aria-expanded', String(!datum.payload?.fold));
          circle.onkeydown = event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault(); circle.dispatchEvent(new MouseEvent('click', {bubbles: true}));
            }
          };
        });
      }
      new MutationObserver(keyboardNodes).observe(svg, {childList: true, subtree: true});
      new ResizeObserver(fit).observe(canvas);
      keyboardNodes(); await fit();
    } catch (error) {
      figure.querySelector('.field-map-canvas').textContent = '地图加载失败，请展开下方 Markdown 源码。';
      figure.querySelector('details').open = true; console.error(error);
    }
  }
  }
  window.initializeFieldMaps = initializeFieldMaps;
  initializeFieldMaps();
  new MutationObserver(() => maps.forEach(recolor)).observe(document.body, {attributes: true, attributeFilter: ['class']});
})();
