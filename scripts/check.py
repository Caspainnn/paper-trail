"""Check generated data, unique IDs and relative local asset links."""
from pathlib import Path
from urllib.parse import unquote,urlsplit
import json,re
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
def main():
    home=BeautifulSoup((ROOT/'index.html').read_text(encoding='utf-8'),'html.parser')
    data=json.loads(home.select_one('#hub-data').string)
    ids=[p['pid'] for p in data['papers']];assert len(ids)==len(set(ids))
    projects=json.loads((ROOT/'experiments/projects.json').read_text(encoding='utf-8'))
    assert len({p['id'] for p in projects})==len(projects)
    records=json.loads((ROOT/'experiments/records.json').read_text(encoding='utf-8'))
    for record in records.values():
        if record.get('paperPid'):assert record['paperPid'] in ids
    pages=[ROOT/'index.html',ROOT/'experiments/index.html',ROOT/'experiments/detail.html']+[ROOT/unquote(p['url'].split('#')[0]) for p in data['papers']]
    checked=0
    for page in set(pages):
        soup=BeautifulSoup(page.read_text(encoding='utf-8'),'html.parser')
        for tag in soup.select('a[href],script[src],img[src],link[href]'):
            value=tag.get('href') or tag.get('src');url=urlsplit(value)
            if url.scheme or not url.path:continue
            target=(page.parent/unquote(url.path)).resolve();assert target.is_relative_to(ROOT)
            assert target.is_file(),str(page)+': '+value
            checked+=1
    print(json.dumps({'passed':True,'papers':len(ids),'projects':len(projects),'local_links':checked}))
if __name__=='__main__':main()
