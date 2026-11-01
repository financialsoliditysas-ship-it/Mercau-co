const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function main(){
 const base='http://127.0.0.1:3198',out=path.resolve('outputs/customer-order-refresh');fs.mkdirSync(out,{recursive:true});
 const env={...process.env};for(const key of Object.keys(env))if(/SUPABASE|NEXT_PUBLIC_|AIRTABLE|SHIPDAY|RESEND|VAPID|SECRET|TOKEN|PASSWORD|API_KEY|OPENAI|META_|NODE_OPTIONS/.test(key))delete env[key];
 Object.assign(env,{NODE_ENV:'production',NEXT_DIST_DIR:'.next-logistics-check',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',NEXT_PUBLIC_SUPABASE_ANON_KEY:'qa-not-a-real-key'});
 const log=fs.openSync(path.join(out,'server.log'),'w');const app=spawn(process.execPath,['--require','./qa/local-only-network.cjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','-p','3198'],{env,stdio:['ignore',log,log],windowsHide:true});let browser;
 try{
  let ready=false;for(let i=0;i<40;i++){try{if((await fetch(base+'/comprar/pedidos')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready);
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const user={id:'11111111-1111-4111-8111-111111111111',email:'qa@example.invalid'},session={access_token:'qa-not-real',refresh_token:'qa-not-real',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,user};
  await context.addInitScript(session=>localStorage.setItem('sb-127-auth-token',JSON.stringify(session)),session);
  const page=await context.newPage();let status='pending',delivery=null,fail=false,reads=0;
  await page.route('**/*',route=>{const request=route.request(),url=new URL(request.url());
   if(url.origin==='http://127.0.0.1:54329')return route.fulfill({json:[]});
   if(url.origin!==base||request.method()!=='GET')return route.abort();
   if(url.pathname==='/api/mi-cuenta/pedidos'){reads++;return route.fulfill({status:fail?503:200,json:fail?{error:'QA read failure'}:{orders:[{public_id:'MCU-1-000001',restaurant_name:'Restaurante ficticio QA',status,delivery,created_at:'2026-10-31T20:00:00Z',address:'Destino ficticio',lines:[{name:'Producto ficticio',quantity:1,unitPrice:10000}],subtotal:10000,delivery_fee:5000}]}});}
   if(url.pathname==='/api/mi-cuenta')return route.fulfill({json:{profile:{name:'QA'},version:1,roles:['buyer'],businesses:[]}});
   if(url.pathname.startsWith('/api/'))return route.fulfill({status:403,json:{error:'QA isolated'}});
   return route.continue();
  });
  await page.goto(base+'/comprar/pedidos');await page.getByRole('button',{name:'Ver detalle del pedido MCU-1-000001',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByText('Esperando al negocio.',{exact:false}).waitFor();
  status='accepted';await page.evaluate(()=>window.dispatchEvent(new Event('mercau:order-updated')));await dialog.getByText('En preparación',{exact:true}).first().waitFor();
  status='ready';delivery={status:'delivered'};await dialog.getByRole('button',{name:'Actualizar estado',exact:true}).click();await dialog.getByText('Entregado',{exact:true}).first().waitFor();assert(await dialog.isVisible());
  fail=true;await dialog.getByRole('button',{name:'Actualizar estado',exact:true}).click();await dialog.getByRole('alert').waitFor();assert((await dialog.getByRole('alert').innerText()).includes('desactualizada'));assert(await dialog.getByText('Entregado',{exact:true}).first().isVisible());
  fail=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await dialog.getByRole('alert').waitFor({state:'detached'});await page.screenshot({path:path.join(out,'delivered-open-detail-390.png')});
  assert(reads>=5);console.log('PASS actual buyer components: authenticated fictional session, pending -> accepted -> delivered in the same open dialog, visible read error and reconnect recovery. Chrome 390 emulated; no real account, orders or dispatches.');
 }finally{await browser?.close();app.kill();await new Promise(resolve=>app.once('exit',resolve));fs.closeSync(log);}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
