"""Render the existing reading log; never modify its source."""
from pathlib import Path
import re
import html
import json
import runpy
from datetime import datetime
import markdown
from bs4 import BeautifulSoup

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / '论文阅读记录.md'
OUTPUT = HERE.parent / '论文阅读记录.html'
HUB = runpy.run_path(str(HERE / 'hub.py'))
MAP = runpy.run_path(str(HERE / 'mindmap.py'))

def information_card(pid, title, chunks, body):
    match = re.search(r'<!-- paper-info: (.*?) -->', body)
    meta = json.loads(match[1]) if match else {}
    sections = {s.get('data-title'): s for s in chunks}
    title_section = sections.get('论文标题')
    full_title = title_section.get_text(' ', strip=True).removeprefix('论文标题').strip() if title_section else ''
    links_section = sections.get('论文链接')
    buttons, code = [], '官方代码尚未确认'
    if links_section:
        for a in links_section.select('a[href]'):
            label = a.get_text(strip=True)
            if '第三方' in label:
                label = '第三方复现'; code = '有第三方复现，官方代码尚未确认'
            elif any(word in label for word in ['作者仓库', '官方代码', '开源代码']):
                label = '开源代码'; code = '已记录作者／官方仓库'
            elif '补充' in label:
                label = '补充材料'
            elif '本地' in label:
                label = '本地 PDF'
            elif '正式' in label:
                label = '正式论文'
            buttons.append(f'<a href="{html.escape(a["href"], quote=True)}">{html.escape(label)} ↗</a>')
    notes = list(meta.get('notes', []))
    if links_section and not match:
        leftover = BeautifulSoup(str(links_section), 'html.parser')
        for tag in leftover.select('h3, a'): tag.decompose()
        text = leftover.get_text(' ', strip=True).strip('。 ·｜|')
        if text: notes.append(text)
    for section in [title_section, links_section]:
        if section is not None: chunks.remove(section)
    def row(label, value):
        return f'<div><dt>{label}</dt><dd>{html.escape(value)}</dd></div>'
    publication = row('会议', meta.get('venue', '待核')) + row('页码', meta.get('pages', '待核')) + row('DOI', meta.get('doi', '待核'))
    resources = row('正文', meta.get('document', '参见本地文件及阅读进度')) + row('补充材料', meta.get('supplement', '待核')) + row('官方代码', code)
    remarks = ('<details class="paper-info-notes"><summary>核验备注 · '+str(len(notes))+' 项</summary><ul>'+''.join('<li>'+html.escape(n)+'</li>' for n in notes)+'</ul></details>') if notes else ''
    status = meta.get('status', '参见阅读进度')
    short_title = re.sub(r'\s*[（(]\d{4}[）)]\s*$', '', title.strip())
    return f'<header class="paper-heading paper-info-card"><div class="paper-identity"><span>{pid} · {html.escape(meta.get("venue", "出版信息待核"))}</span><span class="reading-status">{html.escape(status)}</span></div><h1>{html.escape(short_title)}</h1><p class="paper-full-title">{html.escape(full_title or title.strip())}</p><p class="paper-topic">{html.escape(meta.get("topic", "主题参见下方研究问题与方法"))}</p><nav class="paper-actions" aria-label="论文资料入口">{"".join(buttons)}</nav><div class="paper-info-grid"><div><h2>出版信息</h2><dl>{publication}</dl></div><div><h2>资料情况</h2><dl>{resources}</dl></div></div>{remarks}</header>'

def render():
    source = SOURCE.read_text(encoding='utf-8')
    pieces = re.split(r'^## (P\d+)[｜|](.+)$', source, flags=re.M)
    papers, nav = [], []
    fields = {'论文标题','论文链接','阅读进度','解决什么问题','方法流程图','主要结果','不足','问答记录'}
    for n in range(1, len(pieces), 3):
        pid, title, body = pieces[n:n+3]
        key = pid.lower()
        soup = BeautifulSoup(markdown.markdown(body, extensions=['fenced_code','tables']), 'html.parser')
        # Style evidence notes without touching links, code, or diagram source.
        for node in list(soup.find_all(string=re.compile(r'\[[^\]\n]+\]'))):
            if node.find_parent(['a', 'code', 'pre', 'script', 'style']):
                continue
            parts = re.split(r'(\[[^\]\n]+\])', str(node))
            replacement = []
            for part in parts:
                if re.match(r'^\[(?:§|Fig\.|Table\b|Tables\b|Eq\.|Paper\b|Appendix\b|[A-F]\.\d|P\d+|补充|助手|背景解释|机制解释|建议实验|正式稿核对|阅读判断)', part):
                    note = soup.new_tag('small', attrs={'class': 'evidence-note'})
                    note.string = part
                    replacement.append(note)
                else:
                    replacement.append(part)
            node.replace_with(*replacement)
        # Promote existing field labels; preserve their complete content.
        for p in list(soup.find_all('p', recursive=False)):
            strong = p.find('strong', recursive=False)
            if strong and strong.get_text().rstrip('：:') in fields:
                label = strong.get_text().rstrip('：:')
                h = soup.new_tag('h3'); h.string = label
                strong.decompose(); p.insert_before(h)
                if not p.get_text(strip=True) and not p.find('a'): p.decompose()
        # Group consecutive image-only paragraphs, keeping explanatory text separate.
        gallery = None
        for node in list(soup.contents):
            if getattr(node, 'name', None) is None:
                if str(node).strip(): gallery = None
                continue
            images = node.find_all('img') if node.name == 'p' else []
            if images and not node.get_text(strip=True) and all(getattr(c, 'name', None) == 'img' or not str(c).strip() for c in node.contents):
                if gallery is None:
                    gallery = soup.new_tag('div', attrs={'class': 'image-gallery'})
                    node.insert_before(gallery)
                for img in images:
                    figure = soup.new_tag('figure')
                    figure.append(img.extract())
                    caption = soup.new_tag('figcaption'); caption.string = img.get('alt', '')
                    figure.append(caption); gallery.append(figure)
                node.decompose()
            else:
                gallery = None
        chunks, current = [], None
        for node in list(soup.contents):
            if getattr(node, 'name', None) == 'h3':
                current = soup.new_tag('section', id=f'{key}-s{len(chunks)+1}')
                current['data-title'] = node.get_text()
                if '自己的思考' in node.get_text() or node.get_text() == '思考与改进': current['class'] = ['thinking']
                chunks.append(current); current.append(node.extract())
            elif current is not None: current.append(node.extract())
        for section in chunks:
            if section.get('data-title') == '方法流程图':
                for code in list(section.select('code.language-text')):
                    lines=code.get_text().splitlines()
                    steps=[]
                    for line in lines:
                        if '├' in line or '└' in line: break
                        clean=line.strip().lstrip('→').strip()
                        if clean: steps.append(clean)
                    flow=soup.new_tag('ol',attrs={'class':'flow-list'})
                    for step in steps:
                        li=soup.new_tag('li');li.string=step;flow.append(li)
                    pre=code.parent;pre.insert_before(flow)
                    detail=soup.new_tag('details',attrs={'class':'flow-source'})
                    summary=soup.new_tag('summary');summary.string='完整流程：评测、训练分支与参考方向';detail.append(summary)
                    pre.replace_with(detail);detail.append(pre)
            detail = None
            for node in list(section.contents):
                if getattr(node, 'name', None) == 'h3': continue
                label = node.find('strong', recursive=False) if getattr(node,'name',None)=='p' else None
                if label and re.match(r'^(问\d+|追问)[：:]', label.get_text()):
                    detail = soup.new_tag('details', attrs={'class':'paper-annotation question'})
                    summary = soup.new_tag('summary')
                    for child in list(node.contents): summary.append(child.extract())
                    detail.append(summary); node.replace_with(detail)
                elif detail is not None: detail.append(node.extract())
            for code in list(section.select('code.language-mermaid')):
                pre=code.parent
                figure=soup.new_tag('figure',attrs={'class':'mermaid-figure'})
                view=soup.new_tag('div',attrs={'class':'diagram-view','aria-label':'方法流程图'})
                figure.append(view)
                button=soup.new_tag('button',attrs={'type':'button','class':'diagram-expand'})
                button.string='放大流程图'; figure.append(button)
                details=soup.new_tag('details',attrs={'class':'flow-source'})
                summary=soup.new_tag('summary');summary.string='查看 Mermaid 源码';details.append(summary)
                pre.replace_with(figure);details.append(pre);figure.append(details)
                guide=soup.new_tag('figcaption',attrs={'class':'read-guide'})
                guide.string='点击“放大流程图”查看细节，展开下方源码可查看 Mermaid 文本。'
                figure.append(guide)
            for code in list(section.select('code.language-markmap')):
                tree = MAP['parse_map'](code.get_text())
                pre = code.parent
                figure = soup.new_tag('figure', attrs={'class': 'field-map'})
                canvas = soup.new_tag('div', attrs={'class': 'field-map-canvas'})
                canvas.append(soup.new_tag('svg', attrs={'class': 'field-map-svg', 'role': 'group', 'aria-label': '可折叠的领域思维导图'}))
                figure.append(canvas)
                actions = soup.new_tag('div', attrs={'class': 'map-actions'})
                button = soup.new_tag('button', attrs={'type': 'button', 'data-map-action': 'fullscreen'})
                button.string = '放大思维导图'; actions.append(button); figure.append(actions)
                data = soup.new_tag('script', attrs={'type': 'application/json', 'class': 'field-map-data'})
                data.string = json.dumps(tree, ensure_ascii=False).replace('<', '\\u003c')
                figure.append(data)
                details = soup.new_tag('details', attrs={'class': 'flow-source'})
                summary = soup.new_tag('summary'); summary.string = '查看地图 Markdown 源码'
                details.append(summary)
                pre.replace_with(figure); details.append(pre); figure.append(details)
                guide = soup.new_tag('figcaption', attrs={'class': 'read-guide'})
                guide.string = '圆点展开或收起分支，拖动平移；放大后可在底部缩放，按 Esc 关闭。'
                figure.append(guide)
        card = information_card(pid, title, chunks, body)
        favorite = (f'<button type="button" class="favorite-toggle" data-pid="{pid}" aria-pressed="false" '
                    f'aria-label="收藏 {pid}" title="收藏 {pid}"><img src="网页/favorite-outline.svg" width="24" height="24" alt=""></button>')
        card = card.replace('</div><h1>', favorite+'</div><h1>', 1)
        # Number body headings per paper, keeping semantic field names intact.
        counters = [0, 0, 0]
        for chunk in chunks:
            for heading in chunk.select('h3, h4, h5'):
                level = int(heading.name[1]) - 3
                counters[level] += 1
                for deeper in range(level + 1, 3): counters[deeper] = 0
                heading.insert(0, '.'.join(str(n) for n in counters[:level + 1]) + '  ')
        content=''.join(str(c) for c in chunks)
        papers.append(f'<article class="paper" id="{key}" data-title="{html.escape(title.strip())}">{card}{content}</article>')
        short_title = re.sub(r'\s*[（(]\d{4}[）)]\s*$', '', title.strip())
        nav.append(f'<a class="paper-link" href="#{key}" data-paper="{key}" title="{html.escape(short_title, quote=True)}"><small>{pid}</small><span>{html.escape(short_title)}</span></a>')
    assert papers, 'No paper sections found'
    template=(HERE/'shell.html').read_text(encoding='utf-8')
    result=template.replace('<!--PAPERS-->', ''.join(papers)).replace('<!--NAV-->', ''.join(nav)).replace('/*CSS*/',(HERE/'style.css').read_text(encoding='utf-8')).replace('/*JS*/',(HERE/'app.js').read_text(encoding='utf-8'))
    result=result.replace('<!--UPDATED-->', datetime.fromtimestamp(SOURCE.stat().st_mtime).strftime('%Y-%m-%d %H:%M'))
    result=result.replace('/*READER_WORKSPACE_JS*/', (HERE/'reader-workspace.js').read_text(encoding='utf-8'))
    if 'class="field-map"' in result:
        result=result.replace('</head>', '<style>'+(HERE/'field-map.css').read_text(encoding='utf-8')+'</style></head>')
        result=result.replace('<script src="网页/diagrams.js"></script>', '<script src="网页/diagrams.js"></script><script src="网页/vendor/d3-7.9.0.min.js"></script><script src="网页/vendor/markmap-view-0.18.12.js"></script><script src="网页/field-map.js"></script>')
    result=result.replace('<!--PROJECT_NAV-->', HUB['navigation'](SOURCE))
    result=result.replace('<title>论文阅读笔记</title>', '<title>'+html.escape(SOURCE.stem)+' · 论文阅读笔记</title>')
    result=result.replace('class="nav-caption">我的论文', 'class="nav-caption">本主题论文 · '+str(len(papers))+' 篇')
    result=result.replace('href="论文阅读记录.md"', 'href="'+html.escape(SOURCE.name,quote=True)+'"')
    parsed=BeautifulSoup(result,'html.parser')
    ids=[x['id'] for x in parsed.select('[id]')]; assert len(ids)==len(set(ids))
    assert len(parsed.select('.paper'))==(len(pieces)-1)//3
    assert len(parsed.select('.question'))==len(re.findall(r'^\*\*(?:问\d+|追问)[：:]\*\*',source,re.M))
    for a in parsed.select('a[href]'):
        href=a['href']
        if not href.startswith(('http:','https:','#','mailto:')):
            assert (OUTPUT.parent / href.split('#')[0]).exists(), href
    OUTPUT.write_text(result,encoding='utf-8')
    print(json.dumps({'papers':len(papers),'questions':len(parsed.select('.question')),'output':str(OUTPUT)},ensure_ascii=False))

if __name__=='__main__':
    HUB['render_home']()
    for theme in HUB['THEMES']:
        SOURCE = HERE.parent / (theme['source'] + '.md')
        OUTPUT = SOURCE.with_suffix('.html')
        render()
