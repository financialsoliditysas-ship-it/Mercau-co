const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function main(){
 const base='http://127.0.0.1:3199',out=path.resolve('outputs/alarm-recovery');fs.mkdirSync(out,{recursive:true});
 const env={...process.env};for(const key of Object.keys(env))if(/SUPABASE|NEXT_PUBLIC_|AIRTABLE|SHIPDAY|RESEND|VAPID|SECRET|TOKEN|PASSWORD|API_KEY|OPENAI|META_|NODE_OPTIONS/.test(key))delete env[key];
 Object.assign(env,{NODE_ENV:'production',NEXT_DIST_DIR:'.next-logistics-check',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',NEXT_PUBLIC_SUPABASE_ANON_KEY:'qa-not-a-real-key'});
 const log=fs.openSync(path.join(out,'server.log'),'w'),app=spawn(process.execPath,['--require','./qa/local-only-network.cjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','-p','3199'],{env,stdio:['ignore',log,log],windowsHide:true});let browser;
 try{
  let ready=false;for(let i=0;i<50;i++){try{if((await fetch(base+'/piloto/restaurante')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready);
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const userId='11111111-1111-4111-8111-111111111111',key=`mercau:order-sound:${userId}:restaurante-mercado`;
  await context.addInitScript(userId=>{
   localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:'qa-not-real',refresh_token:'qa-not-real',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:userId,email:'qa@example.invalid'}}));
   window.__qaBlocked=false;window.__qaAudioCalls=0;window.__qaHidden=false;
   Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__qaHidden?'hidden':'visible'});
   window.Audio=class{currentTime=0;pause(){}async play(){window.__qaAudioCalls++;if(window.__qaBlocked)throw new DOMException('QA background restriction','NotAllowedError');}};
   window.Notification=class{constructor(){throw new TypeError('QA mobile notification constructor restriction');}static permission='granted';static async requestPermission(){return 'granted';}};
   if(!window.PushManager)window.PushManager=class{};
   navigator.vibrate=()=>false;
  },userId);
  const page=await context.newPage();let orders=[],writes=0;
  await page.route('**/*',route=>{const r=route.request(),url=new URL(r.url());if(url.origin==='http://127.0.0.1:54329')return route.fulfill({json:[]});if(url.origin!==base||r.method()!=='GET'){writes++;return route.abort();}
   if(url.pathname==='/api/push/subscription')return route.fulfill({json:{available:true,subscribed:true,publicKey:'qa-public-only'}});
   if(url.pathname==='/api/piloto/restaurante')return route.fulfill({json:{orders}});
   if(url.pathname==='/api/mi-cuenta')return route.fulfill({json:{profile:{name:'QA'},version:1,roles:['business_owner'],businesses:[]}});
   if(url.pathname.startsWith('/api/'))return route.fulfill({status:403,json:{error:'QA isolation'}});
   return route.continue();
  });
  const push=()=>page.evaluate(()=>navigator.serviceWorker.dispatchEvent(new MessageEvent('message',{data:{type:'MERCAU_NEW_ORDER_PUSH',orderId:'MCU-1-000001'}})));
  await page.goto(base+'/piloto/restaurante');await page.getByRole('button',{name:'Sonido en esta pantalla',exact:true}).click();await page.getByRole('button',{name:'Pausar sonido local',exact:true}).waitFor();await page.waitForTimeout(4200);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'on');
  orders=[{id:'fake-order',public_id:'MCU-1-000001',status:'pending',created_at:new Date().toISOString(),lines:[{name:'Producto QA',quantity:1,unitPrice:10000}],subtotal:10000,delivery_fee:5000,payment_method:'CASH',address:'Destino ficticio',delivery:null,finance:null}];
  await page.evaluate(()=>{window.__qaHidden=true;window.__qaBlocked=true;document.dispatchEvent(new Event('visibilitychange'));});await push();
  const reactivate=page.getByRole('button',{name:'Reactivar sonido local',exact:true});await reactivate.waitFor();assert.equal(await reactivate.getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'Avisos push activos',exact:true}).waitFor();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'on');
  await page.evaluate(()=>{window.__qaHidden=false;window.__qaBlocked=false;document.dispatchEvent(new Event('visibilitychange'));});await page.getByRole('button',{name:'Pausar sonido local',exact:true}).waitFor();
  await page.evaluate(()=>window.__qaBlocked=true);await push();await reactivate.waitFor();await page.evaluate(()=>window.__qaBlocked=false);await reactivate.click();await page.getByRole('button',{name:'Pausar sonido local',exact:true}).waitFor();
  await page.getByRole('button',{name:'Pausar sonido local',exact:true}).click();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'off');
  await page.getByRole('button',{name:'Sonido en esta pantalla',exact:true}).click();await page.reload();await reactivate.waitFor();assert.equal(await reactivate.getAttribute('aria-pressed'),'true');await page.screenshot({path:path.join(out,'restored-requires-gesture-390.png')});
  assert.equal(writes,0);console.log('PASS actual manager components: blocked background audio preserves preference and push, visible recovery, explicit reactivation/pause and honest restoration after reload. Mocked audio/push/session; Chrome emulated, not physical iPhone. No real sound, notifications, orders or dispatches.');
 }finally{await browser?.close();app.kill();await new Promise(resolve=>app.once('exit',resolve));fs.closeSync(log);}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
