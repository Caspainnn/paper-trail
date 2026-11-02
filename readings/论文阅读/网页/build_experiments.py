"""Generate portable experiment pages from public templates and explicit data."""
from pathlib import Path
import json
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
def build(data):
    out=ROOT/'experiments';out.mkdir(exist_ok=True)
    load=lambda name:json.loads((out/name).read_text(encoding='utf-8'))
    projects=load('projects.json');records=load('records.json')
    encode=lambda x:json.dumps(x,ensure_ascii=False).replace('<','\\u003c')
    library=[{'pid':p['pid'],'title':p['title']} for p in data['papers']]
    store=(HERE/'experiment-projects.js').read_text(encoding='utf-8')
    store=store.replace('return [];','return structuredClone(globalThis.PaperTrailProjects||[]);')
    for source,target in [('experiment-home.html','index.html'),('experiment-detail.html','detail.html')]:
        text=(HERE/source).read_text(encoding='utf-8')
        text=text.replace('<script src="projects.js"></script>','<script>globalThis.PaperTrailProjects='+encode(projects)+';'+store+'</script>')
        text=text.replace('/*PAPER_LIBRARY*/',encode(library)).replace('/*EXPERIMENT_RECORDS*/',encode(records))
        text=text.replace('../../index.html','../index.html').replace('href="index.html" aria-current="page"','href="../index.html#experiments" aria-current="page"')
        text=text.replace('HTML 原型 · 2026.11.02','PaperTrail')
        if target=='index.html':
            text=text.replace('</head>','<style>body.embedded header{display:none}body.embedded main{padding:18px 0 30px}</style></head>')
            text=text.replace('</body>',"<script>if(new URLSearchParams(location.search).get('embed')==='1'){document.body.classList.add('embedded');let b=document.createElement('base');b.target='_top';document.head.append(b);new ResizeObserver(()=>parent.postMessage({type:'experiment-height',height:document.documentElement.scrollHeight},location.protocol==='file:'?'*':location.origin)).observe(document.body);}</script></body>")
        (out/target).write_text(text,encoding='utf-8')
