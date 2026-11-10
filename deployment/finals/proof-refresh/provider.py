"""Allowlisted read-only provider evidence; credentials stay in memory."""
from pathlib import Path
import os,json,urllib.request,datetime,sys
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'docs/evidence/finals-proof-deployment'
PROJECT='prj_87hFYLDrQpbUsSlAgoFMsTIE7aTq'
authdir=Path(os.environ['APPDATA'])/'com.vercel.cli/Data'
token=os.environ.get('VERCEL_TOKEN') or json.loads((authdir/'auth.json').read_text())['token']
team=json.loads((authdir/'config.json').read_text()).get('currentTeam')
def get(path):
    sep='&' if '?' in path else '?'
    req=urllib.request.Request('https://api.vercel.com'+path+sep+'teamId='+team,headers={'Authorization':'Bearer '+token})
    with urllib.request.urlopen(req,timeout=35) as r:return json.load(r)
project=get('/v9/projects/'+PROJECT)
assert project['id']==PROJECT and project['name']=='aegispay-live'
alias=get('/v4/aliases/aegispay-live.vercel.app')
env=get('/v9/projects/'+PROJECT+'/env')
report={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'project':{k:project.get(k) for k in ['id','name','accountId','rootDirectory','framework','nodeVersion','sourceFilesOutsideRootDirectory','buildCommand','installCommand']},'configuredEnvCount':len(env.get('envs',[])),'alias':{k:alias.get(k) for k in ['uid','alias','deploymentId','projectId']},'aliasDeployment':{k:alias.get('deployment',{}).get(k) for k in ['id','url','readyState']},'protectionBypassEntryCount':len(project.get('protectionBypass') or {})}
recent=get('/v6/deployments?projectId='+PROJECT+'&limit=5')
report['recentDeployments']=[{k:d.get(k) for k in ['uid','url','created','state','target']} for d in recent.get('deployments',[])]
if len(sys.argv)>2:
    dep=get('/v13/deployments/'+sys.argv[2])
    report['deployment']={k:dep.get(k) for k in ['id','url','name','projectId','readyState','target','alias','aliasAssigned','createdAt','buildingAt','ready','nodeVersion']}
    report['deployment']['projectSettings']={k:dep.get('projectSettings',{}).get(k) for k in ['nodeVersion','rootDirectory','sourceFilesOutsideRootDirectory']}
    if len(sys.argv)>3 and sys.argv[3]=='files':
        tree=get('/v6/deployments/'+dep['id']+'/files'); paths=[]
        def walk(nodes,base=''):
            for n in nodes:
                p=base+n['name']
                if n.get('type')=='directory':walk(n.get('children',[]),p+'/')
                else:paths.append(p)
        walk(tree); report['deploymentFiles']=paths
(OUT/(sys.argv[1]+'.json')).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
