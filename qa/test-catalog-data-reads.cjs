const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const out=process.env.MERCAU_IMAGE_OUTPUT,results=[];
async function main(){
 const env={...process.env};for(const key of Object.keys(env))if(/SUPABASE|NEXT_PUBLIC_|AIRTABLE|SHIPDAY|RESEND|VAPID|SECRET|API_KEY|OPENAI|META_|NODE_OPTIONS/.test(key))delete env[key];
 Object.assign(env,{NODE_ENV:'production',NEXT_DIST_DIR:'.next-pwa-build',MERCAU_NAVIGATION_TEST:'1',MERCAU_INTEGRAL_TEST:'1',MERCAU_IMAGE_TEST:'1',MERCAU_IMAGE_TRACE:'1',AIRTABLE_API_KEY:'qa-not-a-real-key',AIRTABLE_BASE_ID:'qa-navigation',AIRTABLE_NEGOCIOS_TABLE_ID:'businesses',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',SUPABASE_SERVICE_ROLE_KEY:'qa-not-a-real-key'});
 for(const [version,root,port]of [['before',process.env.MERCAU_IMAGE_BEFORE,3100],['after',process.env.MERCAU_IMAGE_CANDIDATE,3101]]){
  assert(root&&out);fs.mkdirSync(out,{recursive:true});const file=path.join(out,'directory-'+version+'.log'),log=fs.openSync(file,'w');
  const server=spawn(process.execPath,['--require',path.join(__dirname,'catalog-image-fixtures.cjs'),path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','-p',String(port)],{cwd:root,env,stdio:['ignore',log,log],windowsHide:true});
  try{
   const base='http://127.0.0.1:'+port;let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/manifest.webmanifest')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready);
   const response=await fetch(base+'/negocios/restaurante-qa-ficticio/catalogo');assert.equal(response.status,200);await response.text();await new Promise(r=>setTimeout(r,100));
   const count=(fs.readFileSync(file,'utf8').match(/QA_PUBLIC_DIRECTORY_READ/g)||[]).length;results.push({version,publicDirectoryReads:count});
  }finally{server.kill();fs.closeSync(log);}
 }
 fs.writeFileSync(path.join(out,'directory-read-comparison.json'),JSON.stringify({simulatedServices:true,productionChanged:false,results},null,2));console.log(JSON.stringify(results));
 assert(results[0].publicDirectoryReads>=1);assert(results[1].publicDirectoryReads<=results[0].publicDirectoryReads,'Optimization must not add upstream directory reads');
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
