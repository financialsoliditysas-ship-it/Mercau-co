const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:3130',out=path.join(root,'outputs/owner-payout');
const user={id:'77777777-7777-4777-8777-777777777777',email:'owner.qa@example.invalid',aud:'authenticated',role:'authenticated'};
const finance={payment_method:'CASH',payment_status:'PENDING',product_subtotal:60000,merchant_commission_rate_bps:1500,merchant_commission_total:9000,merchant_net:51000};
const order={id:'11111111-1111-4111-8111-111111111111',public_id:'PRB-QA-01',customer_name:'Persona ficticia',customer_phone:'3000000000',address:'Dirección ficticia',neighborhood:'Sector de prueba',instructions:'Solo prueba local',subtotal:60000,delivery_fee:5000,payment_method:'CASH',status:'accepted',created_at:'2026-10-29T10:00:00Z',lines:[{name:'Producto ficticio',quantity:2,unitPrice:30000}],delivery:null,finance,history:[]};
async function main(){
 fs.mkdirSync(out,{recursive:true});const env={...process.env};for(const key of Object.keys(env))if(/SUPABASE|NEXT_PUBLIC_|AIRTABLE|SHIPDAY|RESEND|VAPID|SECRET|API_KEY|OPENAI|META_|NODE_OPTIONS/.test(key))delete env[key];
 Object.assign(env,{NODE_ENV:'production',NEXT_DIST_DIR:'.next-pwa-build',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329'});
 const log=fs.openSync(path.join(out,'server.log'),'w'),server=spawn(process.execPath,['--require','./qa/local-only-network.cjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','-p','3130'],{cwd:root,env,stdio:['ignore',log,log],windowsHide:true});let browser;const results=[];
 try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready);
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  for(const width of [320,390,768,1440]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   await context.addInitScript(user=>{const encode=value=>btoa(JSON.stringify(value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'),token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,exp:Math.floor(Date.now()/1000)+7200,aud:'authenticated'})+'.qa';localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'qa-not-a-real-session',expires_at:Math.floor(Date.now()/1000)+7200,expires_in:7200,token_type:'bearer',user}));},user);
   await context.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin==='http://127.0.0.1:54329')return route.fulfill({json:url.pathname.endsWith('/user')?user:{}});
    if(url.origin!==base)return route.abort();
    if(request.method()!=='GET')return route.fulfill({status:405,json:{error:'Read-only QA'}});
    if(url.pathname==='/api/piloto/restaurante')return route.fulfill({json:{orders:[order,{...order,id:'2',public_id:'PRB-QA-02',finance:[{...finance,merchant_commission_rate_bps:800,merchant_commission_total:4800,merchant_net:55200}]},{...order,id:'3',public_id:'PRB-QA-03',finance:null},{...order,id:'4',public_id:'PRB-QA-04',status:'rejected'}]}});
    if(url.pathname.startsWith('/api/'))return route.fulfill({json:{enabled:false,subscribed:false,publicKey:'',canManage:false}});
    return route.continue();
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(30000);
   await page.goto(base+'/piloto/restaurante',{waitUntil:'networkidle'});
   const blocks=page.getByRole('region',{name:'Valor neto de productos',exact:true});await blocks.first().waitFor();assert.equal(await blocks.count(),3);
   const first=page.locator('#pedido-PRB-QA-01');assert((await first.textContent()).includes('51.000'));assert((await first.textContent()).includes('15 %'));assert((await first.textContent()).includes('65.000'));
   const second=page.locator('#pedido-PRB-QA-02');assert((await second.textContent()).includes('55.200'));assert((await second.textContent()).includes('8 %'));
   assert((await page.locator('#pedido-PRB-QA-03').textContent()).includes('no disponible'));
   assert((await page.locator('#pedido-PRB-QA-04').textContent()).includes('no indica un pago pendiente'));
   await blocks.first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`owner-payout-${width}.png`)});await page.screenshot({path:path.join(out,`owner-payout-${width}-full.png`),fullPage:true});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
   const update=page.getByRole('button',{name:'Actualizar',exact:true});await update.click();assert((await first.textContent()).includes('51.000'));
   assert.deepEqual(errors,[]);results.push({width,net51000:true,negotiatedRate:true,missingState:true,rejectedState:true,refresh:true,noOverflow:true,simulatedSession:true,physicalDevice:false});await context.close();
  }
  console.log(JSON.stringify(results));
 }finally{if(browser)await browser.close();server.kill();fs.closeSync(log);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
