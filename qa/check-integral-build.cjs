const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs/final-verification');fs.mkdirSync(out,{recursive:true});
const env={...process.env};for(const key of Object.keys(env))if(/SUPABASE|NEXT_PUBLIC_|AIRTABLE|SHIPDAY|RESEND|VAPID|SECRET|API_KEY|OPENAI|META_|NODE_OPTIONS/.test(key))delete env[key];
Object.assign(env,{NEXT_TELEMETRY_DISABLED:'1',NEXT_DIST_DIR:'.next-pwa-build',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',NEXT_PUBLIC_SUPABASE_ANON_KEY:'qa-anon-not-a-real-key',MERCAU_BUYER_PREVIEW:'1',MERCAU_PRESENTATION_REVIEW:'1'});
const results={exactCommittedExport:true,productionDeployment:false,physicalDevices:false,commands:[],guards:[]};
function save(){fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
function run(name,args){const log=fs.openSync(path.join(out,name+'.log'),'w');try{execFileSync(process.execPath,args,{cwd:root,env,stdio:['ignore',log,log],timeout:360000});results.commands.push({name,passed:true});console.log('PASS '+name);}catch(error){results.commands.push({name,passed:false,status:error.status});throw error;}finally{fs.closeSync(log);save();}}
async function main(){
 for(const file of ['lib/pilot-checkout.ts','lib/pilot-order-validation.ts','components/buyer/BuyerCheckout.tsx','supabase/drafts/buyer_checkout.sql','app/api/comprador/prueba-pedidos/route.ts'])assert(!fs.existsSync(path.join(root,file)),'Unapproved prototype in release '+file);
 const original=fs.readFileSync(path.join(root,'tsconfig.json'));
 try{
  run('suite',['--require','./qa/local-only-network.cjs','scripts/test-account-suite.cjs']);
  run('pwa-unit',['qa/test-pwa-launch.cjs']);run('home-unit',['qa/test-home-entry.cjs']);
  run('lint',['node_modules/next/dist/bin/next','lint']);
  run('build',['--require','./qa/local-only-network.cjs','node_modules/next/dist/bin/next','build']);
 }finally{if(!fs.readFileSync(path.join(root,'tsconfig.json')).equals(original))fs.writeFileSync(path.join(root,'tsconfig.json'),original);}
 run('typecheck',['node_modules/typescript/bin/tsc','--noEmit','--incremental','false']);
 run('navigation-pwa',['qa/test-presentation-navigation.cjs','--home','--pwa','--production']);
 run('real-routes-simulated-services',['qa/test-integral-routes.cjs']);
 const log=fs.openSync(path.join(out,'guards-server.log'),'w');
 const app=spawn(process.execPath,['--require','./qa/local-only-network.cjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','-p','3087'],{cwd:root,env:{...env,NODE_ENV:'production'},stdio:['ignore',log,log],windowsHide:true});
 try{
  const base='http://127.0.0.1:3087';let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready);
  for(const [url,status]of [['/presentacion-revision',404],['/comprar/prueba-pedido',404],['/api/comprador/prueba-pedidos',404],['/qa/authenticated-app',404],['/outputs/final-verification/results.json',404],['/api/mi-cuenta',401],['/api/mi-cuenta/pedidos',401],['/api/comprador/negocios',503]]){
   const response=await fetch(base+url);assert.equal(response.status,status,url);results.guards.push({url,status});
  }
  const markers=['Asados de prueba','Hamburguesa de prueba','rec00000000000001','Persona de prueba','Plato QA ficticio','Comercio QA ficticio'];let chunks=0;
  function scan(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())scan(file);else if(file.endsWith('.js')){chunks++;const content=fs.readFileSync(file,'utf8');for(const marker of markers)assert(!content.includes(marker),'Synthetic identity exposed in public chunk: '+marker);}}}
  scan(path.join(root,'.next-pwa-build/static/chunks'));results.publicChunkScan={chunks,markers:markers.length,found:0};
  results.prototypeExcluded=true;results.guardFlagsForcedOn=true;console.log('PASS final production guards');
 }finally{app.kill();fs.closeSync(log);save();}
}
main().catch(error=>{results.error=error.message;save();console.error(error.stack);process.exitCode=1;});
