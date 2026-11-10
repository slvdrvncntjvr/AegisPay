import fitz,pathlib,json,hashlib,re
root=pathlib.Path('docs/evidence/finals-pitch-refresh');out=root/'final';out.mkdir(exist_ok=True)
p=pathlib.Path('docs/submission/AegisPay-pitch-draft.pdf');d=fitz.open(p);expected=json.loads((root/'expected.json').read_text());rows=[];alllinks=[]
def normal(x):return re.sub(r'\s+',' ',x).strip()
assert len(d)==8
for i,page in enumerate(d):
 text=page.get_text();assert tuple(page.rect)==(0,0,960,540)
 assert normal(expected['titles'][i]) in normal(text),(i,text)
 assert f'{i+1:02} / 08' in text
 assert 'seconds' not in text and 'presenter prompts' not in text and 'Speaker notes' not in text
 spans=[s for b in page.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
 outside=[s['text'] for s in spans if not page.rect.contains(fitz.Rect(s['bbox']))]
 assert not outside,(i,outside)
 links=[x['uri'] for x in page.get_links() if 'uri' in x];assert links and all(x.startswith('https://') for x in links)
 alllinks+=links
 page.get_pixmap(matrix=fitz.Matrix(4/3,4/3),alpha=False).save(out/f'page-{i+1}.png')
 (out/f'page-{i+1}.txt').write_text(text,encoding='utf-8')
 rows.append({'page':i+1,'title':expected['titles'][i],'characters':len(text),'links':len(links),'textSpansOutside':len(outside),'fonts':sorted(set(s['font'] for s in spans))})
for url in expected['fixedUrls']:assert url in alllinks,url
for h in expected['hashes']:assert 'https://stellar.expert/explorer/testnet/tx/'+h in alllinks
result={'observedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'pageSizePoints':[960,540],'pages':rows,'annotations':len(alllinks),'uniqueTargets':len(set(alllinks)),'allTargets':sorted(set(alllinks)),'notesPrinted':False,'allGatesPassed':True}
(out/'pdf-gates.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k not in ['pages','allTargets']}))
