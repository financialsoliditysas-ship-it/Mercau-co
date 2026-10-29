const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {restaurantId}=require('./presentation-navigation-fixtures.cjs');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:3086',out=path.join(root,'outputs/integral-routes');
const user={id:'77777777-7777-4777-8777-777777777777',email:'buyer.qa@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{delivery_profile:{name:'Comprador QA',phone:'3000000000',address:'Calle ficticia 10',neighborhood:'Sector QA',instructions:'Referencia ficticia'}}};
const order={public_id:'LOCAL-QA-01',created_at:'2026-10-29T10:00:00Z',status:'accepted',address:'Calle ficticia 10',restaurant_name:'Restaurante QA ficticio',lines:[{name:'Plato QA ficticio',unitPrice:10000,quantity:1}],subtotal:10000,delivery_fee:5000,delivery:null};
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const env={...process.env};for(const key of Object.keys(env))if(/SUPABASE|NEXT_PUBLIC_|AIRTABLE|SHIPDAY|RESEND|VAPID|SECRET|API_KEY|OPENAI|META_|NODE_OPTIONS/.test(key))delete env[key];
 Object.assign(env,{NODE_ENV:'production',MERCAU_NAVIGATION_TEST:'1',MERCAU_INTEGRAL_TEST:'1',NEXT_DIST_DIR:'.next-pwa-build',NEXT_TELEMETRY_DISABLED:'1',MERCAU_BUYER_PREVIEW:'1',MERCAU_PRESENTATION_REVIEW:'1',AIRTABLE_API_KEY:'qa-not-a-real-key',AIRTABLE_BASE_ID:'qa-navigation',AIRTABLE_NEGOCIOS_TABLE_ID:'businesses',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',SUPABASE_SERVICE_ROLE_KEY:'qa-not-a-real-key'});
 const log=fs.openSync(path.join(out,'server.log'),'w');
 const app=spawn(process.execPath,['--require',path.join(root,'qa/integral-fixtures.cjs'),'node_modules/next/dist/bin/next','start','-p','3086','--hostname','127.0.0.1'],{cwd:root,env,stdio:['ignore',log,log],windowsHide:true});
 let browser;const results=[];
 try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready);
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage();
   const errors=[],writes=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(30000);
   await page.addInitScript(user=>{
    const encode=value=>btoa(JSON.stringify(value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,exp:Math.floor(Date.now()/1000)+7200,aud:'authenticated'})+'.qa';
    localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'qa-no-real-session',expires_at:Math.floor(Date.now()/1000)+7200,expires_in:7200,token_type:'bearer',user}));
   },user);
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin==='http://127.0.0.1:54329')return route.fulfill({json:url.pathname.endsWith('/user')?user:{},status:200});
    if(url.origin!==base)return route.abort();
    if(url.pathname==='/api/mi-cuenta')return route.fulfill({json:{profile:{...user.user_metadata.delivery_profile,municipality:'Nechí',addresses:[],notifications:{orders:true,deliveries:true,marketing:false}},version:1,roles:['buyer'],businesses:[],preferredRole:'buyer'}});
    if(url.pathname==='/api/mi-cuenta/pedidos')return route.fulfill({json:{orders:[order]}});
    if(request.method()!=='GET'){writes.push(url.pathname);return route.fulfill({status:403,json:{error:'QA writes blocked'}});}
    return route.continue();
   });
   await page.goto(base+'/negocios/restaurante-qa-ficticio/catalogo',{waitUntil:'networkidle'});
   await page.locator('.pilot-visual-menu').waitFor();
   await page.getByRole('button',{name:'Agregar Plato QA ficticio',exact:true}).click();
   const modal=page.getByRole('dialog',{name:'Plato QA ficticio',exact:false});
   await page.locator('.menu-product-full-description').waitFor();
   await page.getByRole('dialog').getByText('Queso QA',{exact:true}).click();
   await page.getByRole('dialog').getByRole('button',{name:'Agregar ·',exact:false}).click();
   await page.getByRole('button',{name:'Continuar',exact:true}).click();
   const review=page.locator('.order-review-presentation');await review.waitFor();
   assert((await review.innerText()).includes('18.000'),'Price/addition/fee must retain existing calculations');
   assert((await review.innerText()).includes('Calle ficticia 10'),'Saved address reused');
   assert.equal(await page.locator('.pilot-menu').isVisible(),false);
   assert.equal(await page.locator('.buyer-checkout').count(),0);
   await review.getByRole('button',{name:'Editar datos',exact:true}).click();
   await page.getByLabel('Direccion de entrega',{exact:true}).fill('Calle ficticia 11');
   await page.getByLabel('Pagar por transferencia Bre-B',{exact:true}).check();
   await page.getByRole('button',{name:'Revisar solicitud',exact:true}).click();
   await review.waitFor();assert((await review.innerText()).includes('Calle ficticia 11'));assert((await review.innerText()).includes('Transferencia Bre-B al recibir'));
   const confirm=review.getByRole('button',{name:'Confirmar pedido',exact:true});
   await confirm.evaluate(el=>el.scrollIntoView({block:'center'}));
   assert(await confirm.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el===hit||el.contains(hit);}));
   // No order is submitted. Tracking is exercised with a pre-existing fictitious response.
   await page.goto(base+'/comprar/pedidos',{waitUntil:'networkidle'});
   await page.getByRole('button',{name:'Ver detalle del pedido LOCAL-QA-01',exact:true}).click();
   await page.getByRole('dialog',{name:'Detalle del pedido',exact:true}).waitFor();
   assert((await page.getByRole('dialog').innerText()).includes('En preparación'));
   await page.getByRole('button',{name:'Cerrar detalle del pedido',exact:true}).click();
   await page.getByRole('link',{name:'Mi cuenta',exact:true}).last().click();
   const profile=page.getByRole('link',{name:'Ver mi perfil',exact:true});await profile.waitFor();assert.equal(await profile.getAttribute('href'),'/mi-cuenta/perfil');
   await profile.click();await page.locator('[data-profile-section="personal"]').waitFor();
   assert.deepEqual(errors,[]);assert(!writes.includes('/api/piloto/restaurante'),'No order submissions permitted');
   results.push({width,realCommercialRoute:true,realComponents:true,serviceResponses:'fictitious in-memory/HTTP intercepted',auth:'simulated SDK session, not real login',savedAddress:true,optionalEdit:true,personalization:true,total:18000,detail:true,profileLink:true,confirmedOrders:0,physicalDevice:false});
   await context.close();
  }
  console.log(JSON.stringify(results));
 }finally{if(browser)await browser.close();app.kill();fs.closeSync(log);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
