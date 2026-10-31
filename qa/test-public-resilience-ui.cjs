const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,spawnSync}=require('node:child_process');
const {chromium}=require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs/resilience'),base='http://127.0.0.1:3210';
async function main(){
 fs.mkdirSync(out,{recursive:true});const log=fs.openSync(path.join(out,'server.log'),'w');
 const server=spawn(process.execPath,['qa/dish-review-server.cjs'],{cwd:root,env:{...process.env,DISH_REVIEW_PORT:'3210'},stdio:['ignore',log,log],windowsHide:true});let browser;
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/comprar/restaurantes')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready);
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'}),page=await context.newPage();page.setDefaultTimeout(30000);
  await context.addInitScript(()=>localStorage.setItem('mercau.buyer.destination.v1',JSON.stringify({municipality:'Nechí',source:'manual'})));
  await page.goto(base+'/comprar/restaurantes');await page.locator('.dish-card').first().waitFor();
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  await page.reload();await page.locator('.dish-card').first().waitFor();
  // Exercise the existing product editor and basket, with operational methods blocked by the adapter.
  await page.locator('.dish-card button').first().click();const editor=page.locator('.pilot-customizer');await editor.waitFor();
  await editor.getByRole('button',{name:/^Agregar ·/}).click();await page.getByText('Agregado a tu pedido',{exact:true}).waitFor();
  const before=await page.evaluate(()=>Object.fromEntries(Object.keys(sessionStorage).filter(key=>key.startsWith('mercau:catalog-cart:')).map(key=>[key,sessionStorage.getItem(key)])));
  assert(Object.keys(before).length);
  await context.setOffline(true);await page.getByText('Sin conexión. Puedes revisar lo ya cargado; reconecta para actualizar y confirmar pedidos.',{exact:true}).waitFor();
  assert(await page.locator('.pilot-cart-line').isVisible());
  const after=await page.evaluate(()=>Object.fromEntries(Object.keys(sessionStorage).filter(key=>key.startsWith('mercau:catalog-cart:')).map(key=>[key,sessionStorage.getItem(key)])));
  assert.deepEqual(after,before);
  // Public data can be read immediately from the session snapshot without a network request.
  const snapshot=await page.evaluate(async()=>{const key=Object.keys(sessionStorage).find(key=>key.startsWith('mercau:public-browse:v1:')&&key.includes('mode=menu'));return key?JSON.parse(sessionStorage.getItem(key)):null;});
  assert(snapshot?.data.menu.length);await page.screenshot({path:path.join(out,'offline-cart-390.png')});
  await page.goto(base+'/comprar/explorar');await page.getByRole('heading',{name:'No hay conexión en este momento',exact:true}).waitFor();
  await page.screenshot({path:path.join(out,'offline-navigation-390.png')});
  const keys=await page.evaluate(async()=>{const names=await caches.keys(),cache=await caches.open(names.find(name=>name==='mercau-public-offline-v1'));return(await cache.keys()).map(request=>new URL(request.url).pathname);});
  assert(!keys.some(key=>key.startsWith('/api/mi-cuenta')||key.startsWith('/api/piloto')||key.includes('pagos')));
  await context.setOffline(false);await page.getByRole('link',{name:'Intentar nuevamente',exact:true}).click();await page.getByRole('heading',{name:'¿Qué quieres pedir hoy?',exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.keys(sessionStorage).filter(key=>key.startsWith('mercau:catalog-cart:')).map(key=>[key,sessionStorage.getItem(key)]))),before);
  const report={passed:true,physicalDevice:false,localAdapter:true,workerInstalled:true,cartPreserved:true,offlineNavigationHelp:true,reconnection:true,privateResponsesCached:false,realOrders:0,realPush:0};
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{if(browser)await browser.close();if(process.platform==='win32')spawnSync('taskkill',['/pid',String(server.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});else server.kill();fs.closeSync(log);}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
