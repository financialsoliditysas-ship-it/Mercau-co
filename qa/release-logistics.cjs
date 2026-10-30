const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs/logistics-release');fs.mkdirSync(out,{recursive:true});
const cli='C:/Users/isver/AppData/Local/npm-cache/_npx/323e1700ae881c51/node_modules/vercel/dist/vc.js';
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim())throw Error('Commit the exact release input before uploading');
const dry=process.argv.includes('--dry');
if(!dry&&!process.argv.includes('--deploy'))throw Error('Choose --dry or explicitly authorized --deploy');
const env={...process.env,VERCEL_TELEMETRY_DISABLED:'1',NO_UPDATE_NOTIFIER:'1'};
for(const key of Object.keys(env))if(/^(NEXT_PUBLIC_|SUPABASE_|AIRTABLE_|SHIPDAY_|MERCAU_|NEXT_DIST_DIR$|NODE_OPTIONS$)/.test(key))delete env[key];
const args=[cli,'deploy','--project','prj_9niRSTqsAByRqgHPgeaVwGU2DRaX','--scope','team_avjo0aovSEE9UaNytTPldyfM','--prod','--skip-domain','--non-interactive','--yes','--json',
 '--meta',`githubCommitSha=${sha}`,'--meta',`githubCommitRef=fix/logistics-safety-20261029`,'--meta','githubRepo=Mercau-co','--meta','githubOrg=financialsoliditysas-ship-it'];
if(dry)args.push('--dry');
const fd=fs.openSync(path.join(out,dry?'dry.stderr.log':'deploy.stderr.log'),'w');
try{
 const raw=execFileSync(process.execPath,args,{cwd:root,env,encoding:'utf8',stdio:['ignore','pipe',fd],timeout:600000,maxBuffer:24*1024*1024,windowsHide:true});
 const result=JSON.parse(raw);fs.writeFileSync(path.join(out,dry?'dry.json':'deployment.json'),raw);
 if(dry){
  const files=[];function walk(value){if(!value||typeof value!=='object')return;if(typeof value.file==='string')files.push(value.file);if(typeof value.path==='string')files.push(value.path);for(const nested of Object.values(value))if(typeof nested==='object')walk(nested);}
  walk(result);if(!files.length)throw Error('Dry output did not expose source filenames; inspect it before uploading');
  const forbidden=files.filter(file=>/(^|[\\/])(\.env[^\\/]*|qa|outputs|node_modules|supabase|scripts|docs|\.next[^\\/]*)($|[\\/])/.test(file));
  if(forbidden.length)throw Error('Unexpected release source files: '+forbidden.slice(0,10).join(', '));
  console.log(JSON.stringify({dry:true,commit:sha,files:files.length,forbidden:0}));
 }else{
  const d=result.deployment||result.result||result;
  console.log(JSON.stringify({commit:sha,id:d.id||d.uid,url:d.url,state:d.readyState||d.state,target:d.target}));
 }
}finally{fs.closeSync(fd);}
