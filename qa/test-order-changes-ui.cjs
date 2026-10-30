const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs/order-changes'),base='http://127.0.0.1:3179';
const user={id:'11111111-1111-4111-8111-111111111111',email:'qa@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{}};
const line={lineId:'44444444-4444-4444-8444-444444444444',productId:'old',name:'Producto original ficticio',quantity:2,unitPrice:10000,selections:[],note:'Sin salsa'};
const product={id:'new',name:'Alternativa ficticia con nombre largo para comprobar la lectura',description:'Solo prueba',category:'Prueba',price:12000,image:'',optionGroups:[]};
const alternative={...line,productId:product.id,name:product.name,unitPrice:12000,note:''};
const order=()=>({id:'22222222-2222-4222-8222-222222222222',public_id:'PRB-000001',restaurant_name:'Restaurante ficticio',status:'pending',created_at:'2026-10-30T12:00:00Z',address:'Direccion ficticia',lines:[line],subtotal:20000,delivery_fee:5000,delivery:null,changes:[],finance:{payment_status:'PENDING',payment_method:'CASH',merchant_net:17000},payment_method:'CASH'});
async function main(){
 fs.mkdirSync(out,{recursive:true});const env={...process.env};for(const key of Object.keys(env))if(/SUPABASE|NEXT_PUBLIC_|AIRTABLE|SHIPDAY|RESEND|VAPID|SECRET|TOKEN|PASSWORD|API_KEY|OPENAI|META_|NODE_OPTIONS/.test(key))delete env[key];
 Object.assign(env,{NODE_ENV:'production',NEXT_DIST_DIR:'.next-logistics-check',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329'});
 const log=fs.openSync(path.join(out,'server.log'),'w'),server=spawn(process.execPath,['--require','./qa/local-only-network.cjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','-p','3179'],{cwd:root,env,stdio:['ignore',log,log],windowsHide:true});
 let browser;const results=[],shots=[];
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}assert(ready);
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  for(const width of [320,390]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});let state=order(),posts=0;
   await context.addInitScript(user=>{
    const encode=value=>btoa(JSON.stringify(value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'),token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,exp:Math.floor(Date.now()/1000)+7200,aud:'authenticated'})+'.qa';
    localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'qa-not-real',expires_at:Math.floor(Date.now()/1000)+7200,expires_in:7200,token_type:'bearer',user}));
    window.__permissionCalls=0;Object.defineProperty(window,'Notification',{configurable:true,value:Object.assign(function(){},{permission:'default',requestPermission:()=>{window.__permissionCalls++;return Promise.resolve('denied');}})});
   },user);
   await context.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin==='http://127.0.0.1:54329')return route.fulfill({json:url.pathname.endsWith('/user')?user:{}});
    if(url.origin!==base)return route.abort();
    if(url.pathname==='/api/mi-cuenta')return route.fulfill({json:{profile:{name:'Persona ficticia'},version:1,roles:['buyer'],businesses:[]}});
    if(url.pathname==='/api/mi-cuenta/pedidos')return route.fulfill({json:{orders:[state]}});
    if(url.pathname==='/api/piloto/restaurante')return route.fulfill({json:url.searchParams.get('mode')==='menu'?{menu:[product],fee:5000,enabled:true}:{orders:[state]}});
    if(url.pathname==='/api/push/comprador')return route.fulfill({json:{available:true,publicKey:'fictitious-public-key',subscribed:false}});
    if(url.pathname==='/api/pedidos/cambios'){
     posts++;const body=request.postDataJSON();
     if(body.action==='propose'){assert.equal(body.changes[0].productId,product.id);state.changes=[{id:'33333333-3333-4333-8333-333333333333',status:'pending',old_lines:[line],new_lines:[alternative],old_subtotal:20000,new_subtotal:24000,created_at:'2026-10-30T12:01:00Z',responded_at:null}];}
     else if(body.action==='accept'){state={...state,lines:[alternative],subtotal:24000,changes:[{...state.changes[0],status:'accepted'}]};}
     else throw Error('Unexpected UI operation');
     return route.fulfill({json:{ok:true}});
    }
    if(url.pathname.startsWith('/api/'))return route.fulfill({json:{}});
    return route.continue();
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(20000);
   await page.goto(base+'/piloto/restaurante',{waitUntil:'networkidle'});
   const options=page.getByText('Opciones del pedido · Hay un producto agotado',{exact:true});await options.waitFor();
   assert.equal(await options.evaluate(element=>element.parentElement.open),false,'Business editor must remain collapsed');
   await page.getByRole('heading',{name:'PRB-000001',exact:true}).scrollIntoViewIfNeeded();
   const summaryShot=`negocio-opciones-cerradas-${width}.png`;await page.screenshot({path:path.join(out,summaryShot)});shots.push(summaryShot);
   await page.getByText('Opciones del pedido · Hay un producto agotado',{exact:true}).click();
   await page.getByLabel('Qué propones').selectOption('replace');await page.getByLabel('Producto disponible').selectOption('new');
   const sendButton=page.getByRole('button',{name:'Enviar propuesta para aprobación',exact:true});
   assert.deepEqual(await sendButton.evaluate(element=>({background:getComputedStyle(element).backgroundColor,color:getComputedStyle(element).color})),{background:'rgb(226, 20, 18)',color:'rgb(255, 255, 255)'},'Proposal button contrast must not be overridden by legacy panel styles');
   const managerShot=`negocio-${width}.png`;await page.screenshot({path:path.join(out,managerShot),fullPage:true});shots.push(managerShot);
   await page.getByRole('button',{name:'Enviar propuesta para aprobación',exact:true}).click();
   await page.getByText('Esperando la respuesta del comprador. No solicites domiciliario.',{exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Aceptar pedido',exact:true}).isDisabled(),true);
   assert.equal(posts,1);
   await page.goto(base+'/comprar/pedidos?pedido=PRB-000001',{waitUntil:'networkidle'});
   const dialog=page.getByRole('dialog',{name:'Detalle del pedido'});await dialog.waitFor();
   await dialog.getByRole('heading',{name:'Cambio propuesto',exact:true}).waitFor();
   assert.equal(await dialog.locator('.order-change-summary>details').evaluate(element=>element.open),false,'The complete breakdown must be collapsed initially');
   await dialog.getByText('Ver ingredientes y detalle',{exact:true}).click();
   await dialog.getByRole('heading',{name:'Pedido original',exact:true}).waitFor();
   await dialog.getByText('Ver ingredientes y detalle',{exact:true}).click();
   const buyerShot=`comprador-${width}.png`;await page.screenshot({path:path.join(out,buyerShot)});shots.push(buyerShot);
   const acceptButton=dialog.getByRole('button',{name:/Aceptar cambio/});await acceptButton.scrollIntoViewIfNeeded();
   assert(await acceptButton.evaluate(element=>{const r=element.getBoundingClientRect();return r.height>=44&&r.top>=0&&r.bottom<=innerHeight&&element.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}),'Accept action must be visible and unobscured after dialog scroll');
   const actionsShot=`comprador-acciones-${width}.png`;await page.screenshot({path:path.join(out,actionsShot)});shots.push(actionsShot);
   assert.equal(await page.evaluate(()=>window.__permissionCalls),0);
   page.once('dialog',dialog=>dialog.dismiss());await dialog.getByRole('button',{name:/Aceptar cambio/}).click();assert.equal(posts,1);
   page.once('dialog',dialog=>dialog.accept());await dialog.getByRole('button',{name:/Aceptar cambio/}).click();
   await dialog.getByRole('heading',{name:'Cambio aceptado',exact:true}).waitFor();assert.equal(posts,2);
   await dialog.getByRole('button',{name:'Cerrar detalle del pedido'}).click();
   await page.getByRole('button',{name:'Activar notificaciones',exact:true}).click();assert.equal(await page.evaluate(()=>window.__permissionCalls),1);
   await page.getByText(/Puedes consultar los cambios en Mis pedidos/).waitFor();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');assert.deepEqual(errors,[]);
   results.push({width,passed:true,simulatedSessionAndServices:true,physicalDevice:false,posts,permissionRequests:1});await context.close();
  }
  const html='<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Cambios de pedido · Prueba local</title><style>body{font:16px Arial,sans-serif;margin:24px;color:#161616}main{display:flex;gap:24px;flex-wrap:wrap}figure{margin:0;max-width:390px}img{width:100%;border:1px solid #ddd}h1{color:#b11614}</style><h1>Propuestas de cambio · Mercáu</h1><p>Componentes reales, sesiones y servicios simulados. Solo datos ficticios. Chrome emulado en 320 y 390 px, no dispositivos físicos. Sin pedidos ni push reales.</p><main>'+shots.map(file=>'<figure><figcaption>'+file+'</figcaption><img alt="'+file+'" src="data:image/png;base64,'+fs.readFileSync(path.join(out,file)).toString('base64')+'"></figure>').join('')+'</main></html>';
  fs.writeFileSync(path.join(out,'galeria-cambios-pedido.html'),html);console.log(JSON.stringify(results));
 }finally{if(browser)await browser.close();server.kill();fs.closeSync(log);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
