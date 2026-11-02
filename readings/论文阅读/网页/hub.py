"""Reading hub data and HTML. Markdown remains the only published content source."""
from pathlib import Path
from datetime import date, datetime, timedelta, timezone
from urllib.parse import quote
import html
import json
import re
import markdown
from bs4 import BeautifulSoup
from mindmap import parse_map

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
READINGS = HERE.parent
THEMES = [{'id': 'reading', 'name': '我的论文', 'source': '论文阅读记录', 'current': True, 'description': '整理自己的论文、问题与阅读停点。', 'note': '研究方向.md'}]


def today_shanghai():
    return datetime.now(timezone(timedelta(hours=8))).date()


def plain(text):
    return BeautifulSoup(markdown.markdown(text, extensions=['tables', 'fenced_code']), 'html.parser').get_text(' ', strip=True)


def read_activity(path, paper_ids, today):
    """Only explicit table rows are events. Dates elsewhere in notes are not events."""
    if not path.exists():
        return []
    rows = {}
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        if not re.match(r'^\s*\|\s*\d{4}-', line):
            continue
        cells = [s.strip().replace('&#124;', '|') for s in line.strip().strip('|').split('|')]
        if len(cells) != 3:
            raise ValueError(f'阅读活动需三列：{line}')
        day, pid, note = cells
        if date.fromisoformat(day).isoformat() != day or date.fromisoformat(day) > today:
            raise ValueError(f'阅读活动日期无效或在未来：{day}')
        if pid not in paper_ids:
            raise ValueError(f'阅读活动包含未知论文：{pid}')
        key = (day, pid)
        if key in rows:
            if note and note not in rows[key]['note']:
                rows[key]['note'] += ' / ' + note
        else:
            rows[key] = {'date': day, 'pid': pid, 'note': note}
    return sorted(rows.values(), key=lambda r: (r['date'], r['pid']))


def read_reproductions(root):
    """Read durable experiment progress; never infer progress from folder contents."""
    projects, seen = [], set()
    for path in sorted((root / 'experiments').glob('*/progress.md')):
        text = path.read_text(encoding='utf-8')
        match = re.search(r'<!-- reproduction: (.*?) -->', text, re.S)
        if not match:
            raise ValueError(f'复现进度缺少元数据：{path}')
        meta = json.loads(match[1])
        required = ('id', 'paper', 'title', 'status', 'stage', 'updated', 'next')
        if not isinstance(meta, dict) or any(not isinstance(meta.get(k), str) or not meta[k].strip() for k in required):
            raise ValueError(f'复现进度字段不完整：{path}')
        if not re.fullmatch(r'[a-z0-9-]+', meta['id']) or meta['id'] in seen or not re.fullmatch(r'P\d+', meta['paper']):
            raise ValueError(f'复现项目编号无效或重复：{path}')
        if date.fromisoformat(meta['updated']).isoformat() != meta['updated']:
            raise ValueError(f'复现日期无效：{path}')
        seen.add(meta['id'])
        readme = path.parent / 'README.md'
        if not readme.is_file():
            raise ValueError(f'复现项目缺少README：{path.parent}')
        relative = lambda p: quote(p.resolve().relative_to(root.resolve()).as_posix(), safe='/')
        projects.append({**{k: meta[k] for k in required},
                         'markdown': (text[:match.start()] + text[match.end():]).strip(),
                         'progress_url': relative(path), 'readme_url': relative(readme)})
        if meta.get('logic_map'):
            source = (path.parent / meta['logic_map']).resolve()
            if source.parent != path.parent.resolve() or source.suffix != '.md':
                raise ValueError(f'研究导图必须位于当前复现目录：{path}')
            match_map = re.search(r'^```markmap\s*\n(.*?)^```\s*$', source.read_text(encoding='utf-8'), re.M | re.S)
            if not match_map:
                raise ValueError(f'研究导图缺少 markmap 来源：{source}')
            body = match_map[1]
            projects[-1]['logic_map'] = {'tree': parse_map(body), 'source': body, 'url': relative(source)}
    return projects


def collect():
    themes, papers = [], []
    for definition in THEMES:
        theme = dict(definition)
        source = READINGS / (theme['source'] + '.md')
        theme['url'] = quote(str((source.with_suffix('.html')).relative_to(ROOT)).replace('\\', '/'), safe='/')
        pieces = re.split(r'^## (P\d+)[｜|](.+)$', source.read_text(encoding='utf-8'), flags=re.M)
        group = []
        for i in range(1, len(pieces), 3):
            pid, title, body = pieces[i:i+3]
            match = re.search(r'<!-- paper-info: (.*?) -->', body)
            meta = json.loads(match[1]) if match else {}
            progress = re.search(r'\*\*阅读进度[：:]\*\*\s*(.*?)(?=\n\n|\Z)', body, re.S)
            progress = plain(progress[1]) if progress else ''
            stamp = re.search(r'\b202\d-\d{2}-\d{2}\b', progress)
            stop = re.search(r'当前停点[：:](.*?)(?:下一步|$)', progress)
            paper = {'pid': pid, 'title': re.sub(r'\s*[（(]\d{4}[）)]\s*$', '', title.strip()),
                     'theme': theme['id'], 'url': theme['url'] + '#' + pid.lower(),
                     'questions': len(re.findall(r'^\*\*问\d+[：:]\*\*', body, re.M)),
                     'status': meta.get('status', '参见阅读进度'),
                     'date': stamp[0] if stamp else '',
                     'stop': stop[1].strip().rstrip('。') if stop else progress,
                     'progress': progress, 'search': plain(body)}
            papers.append(paper)
            group.append(paper)
        theme['count'] = len(group)
        theme['questions'] = sum(p['questions'] for p in group)
        themes.append(theme)
    ids = [p['pid'] for p in papers]
    if len(ids) != len(set(ids)):
        raise ValueError('主阅读记录存在重复P编号，不能重复统计')
    current_theme = next(t for t in themes if t.get('current'))
    current = next(p for p in reversed(papers) if p['theme'] == current_theme['id'])
    return {'themes': themes, 'papers': papers, 'current': current,
            'reproductions': read_reproductions(ROOT),
            'activity': read_activity(ROOT / 'readings/阅读活动.md', set(ids), today_shanghai()),
            'today': today_shanghai().isoformat()}


def navigation(source):
    """Shared cross-topic entry points, without moving or rewriting any paper body."""
    current = next((t for t in THEMES if source.stem == t['source']), None)
    if current is None:
        return ''
    esc = html.escape
    options = ''.join(f'<option value="{esc(t["source"])}.html" data-theme="{t["id"]}"'
                      f'{" selected" if t["id"] == current["id"] else ""}>{esc(t["name"])}</option>' for t in THEMES)
    return ('<header class="project-header"><a href="../../index.html">← 阅读总览</a>'
            '<label for="topic-nav">主题</label><select id="topic-nav" aria-label="切换阅读主题">'
            + options + '</select><a class="direction-link" href="../研究笔记/' + esc(current['note'])
            + '">方向笔记 ↗</a></header>')


def render_home():
    data = collect()
    # Reuse the exact sun/moon assets already used by the reading pages.
    icon_source = (HERE / 'app.js').read_text(encoding='utf-8')
    data['themeIcons'] = dict(re.findall(r'(sun|moon):`(.*?)`', icon_source, re.S))
    assert set(data['themeIcons']) == {'sun', 'moon'}, 'Reading theme icons missing'
    esc = html.escape
    tiles = []
    for t in data['themes']:
        badge = '<span class="badge">当前</span>' if t.get('current') else ''
        tiles.append(f'<a class="topic-tile" href="{t["url"]}"><div><h3>{esc(t["name"])} {badge}</h3>'
                     f'<p class="topic-count">{t["count"]} 篇阅读记录 · {t["questions"]} 组问答</p>'
                     f'<p class="topic-description">{esc(t["description"])}</p></div><span class="tile-link">进入主题 →</span></a>')
    current = data['current']
    template = (HERE / 'hub.html').read_text(encoding='utf-8')
    template = template.replace('</head>', '<style>' + (HERE/'field-map.css').read_text(encoding='utf-8') + '</style></head>')
    template = template.replace('/*MAP_FULLSCREEN_JS*/', (HERE/'diagrams.js').read_text(encoding='utf-8').split('// Source stays in Markdown.')[0])
    replacements = {'<!--THEME_COUNT-->': str(len(data['themes'])), '<!--PAPER_COUNT-->': str(len(data['papers'])),
                    '<!--QA_COUNT-->': str(sum(p['questions'] for p in data['papers'])),
                    '<!--CURRENT_TITLE-->': esc(current['pid'] + ' · ' + current['title']),
                    '<!--CURRENT_STATUS-->': esc(current['status']), '<!--CURRENT_STOP-->': esc(current['stop']),
                    '<!--CURRENT_DATE-->': esc(current['date'] or '未标注'), '<!--CURRENT_URL-->': current['url'],
                    '<!--TILES-->': ''.join(tiles), '/*HUB_CSS*/': (HERE / 'hub.css').read_text(encoding='utf-8'),
                    '/*HUB_JS*/': (HERE / 'hub.js').read_text(encoding='utf-8'),
                    '/*WORKSPACE_JS*/': (HERE / 'workspace.js').read_text(encoding='utf-8'),
                    '<!--HUB_DATA-->': json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')}
    for key, value in replacements.items():
        template = template.replace(key, value)
    (ROOT / 'index.html').write_text(template, encoding='utf-8')
    import runpy
    runpy.run_path(str(HERE / 'build_experiments.py'))['build'](data)
    print(json.dumps({'home': str(ROOT / 'index.html'), 'papers': len(data['papers']),
                      'questions': sum(p['questions'] for p in data['papers']), 'activity': len(data['activity'])}, ensure_ascii=False))


if __name__ == '__main__':
    render_home()
