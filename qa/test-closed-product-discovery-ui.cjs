const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn,spawnSync}=require('node:child_process');
const {chromium}=require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function main(){
 const base='http://127.0.0.1:3204',out=path.resolve('outputs/closed-products');fs.mkdirSync(out,{recursive:true});
 const fixture=JSON.parse(fs.readFileSync('outputs/dish-discovery/public-fixture.json'));
 const business=[...fixture.businesses].sort((a,b)=>a.id.localeCompare(b.id))[0],product=fixture.menus[business.id].menu[0];
 const log=fs.openSync(path.join(out,'server.log'),'w'),server=spawn(process.execPath,['qa/dish-review-server.cjs'],{env:{...process.env,DISH_REVIEW_PORT:'3204'},stdio:['ignore',log,log],windowsHide:true});let browser;const shots=[];
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/comprar/restaurantes')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready);
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  for(const width of [320,390,768,1440]){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage();let writes=0;
   await context.addInitScript(()=>localStorage.setItem('mercau.buyer.destination.v1',JSON.stringify({municipality:'Nechí',source:'manual'})));
   await page.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==base)return route.abort();if(request.method()!=='GET'&&url.pathname!=='/api/metricas'){writes++;return route.abort();}
    if(url.pathname==='/api/comprar/platos'){const response=await route.fetch(),data=await response.json();data.products=data.products.map(item=>({...item,...(item.id===product.id?{acceptingOrders:false,availabilityMessage:'Cerrado. Horario de prueba.',nextOpeningAt:'2026-11-03T13:08:00Z'}:{})})).sort((a,b)=>Number(b.acceptingOrders!==false)-Number(a.acceptingOrders!==false));return route.fulfill({response,json:data});}
    if(url.pathname==='/api/piloto/restaurante'&&url.searchParams.get('restaurant')===business.id){const menu=fixture.menus[business.id];return route.fulfill({json:url.searchParams.get('mode')==='menu'?{...menu,enabled:false,availabilityMessage:'Cerrado. Horario de prueba.'}:{enabled:false,availabilityMessage:'Cerrado. Horario de prueba.'}});}
    return route.continue();
   });
   await page.goto(base+'/comprar/restaurantes');const closed=page.locator('.dish-card-closed').first();await closed.waitFor();await closed.getByText('Cerrado',{exact:true}).waitFor();assert((await closed.innerText()).includes(product.name));assert((await closed.innerText()).includes('Abre'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await closed.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`cards-${width}.png`)});shots.push(`cards-${width}.png`);
   await closed.getByRole('button').click();const detail=page.locator('.pilot-customizer');await detail.waitFor();await detail.getByRole('heading',{name:product.name,exact:true}).waitFor();assert(await detail.getByRole('button',{name:'Negocio cerrado',exact:true}).isDisabled());await detail.getByText('Puedes consultar el producto, pero no agregarlo al pedido.',{exact:false}).waitFor();
   await detail.getByRole('button',{name:'Negocio cerrado',exact:true}).evaluate(button=>button.click());assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith('mercau:catalog-cart:')).length),0);
   await page.screenshot({path:path.join(out,`detail-${width}.png`)});shots.push(`detail-${width}.png`);assert.equal(writes,0);await context.close();
  }
  const html='<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Productos cerrados · Revisión local</title><style>body{font:16px Arial,sans-serif;margin:24px;color:#171717}h1{color:#e21412}main{display:flex;gap:20px;overflow:auto}figure{margin:0;flex-shrink:0;width:390px}img{width:100%;height:auto;border:1px solid #ddd}figcaption{margin:10px 0}</style><h1>Productos visibles · Negocio cerrado</h1><p>Prueba local con captura pública previa y cierre/apertura ficticios para comprobar presentación. No publicada. Chrome emulado, no dispositivos físicos. Sin pedidos ni despachos.</p><main>'+shots.map(file=>'<figure><figcaption>'+file+'</figcaption><img alt="'+file+'" src="data:image/png;base64,'+fs.readFileSync(path.join(out,file)).toString('base64')+'"></figure>').join('')+'</main></html>';
  fs.writeFileSync(path.join(out,'galeria-cerrados.html'),html);
  console.log('PASS closed product cards/details at 320, 390, 768 and 1440: visible photo/name/price/closed badge/opening, readable detail, disabled purchase and empty cart. Mocked availability; no real orders.');
 }finally{await browser?.close();if(process.platform==='win32')spawnSync('taskkill',['/pid',String(server.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});else server.kill();fs.closeSync(log);}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
