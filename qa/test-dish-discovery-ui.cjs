const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,spawnSync}=require('node:child_process');
const {chromium}=require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs/dish-discovery'),base='http://127.0.0.1:3200';
const fixture=JSON.parse(fs.readFileSync(path.join(out,'public-fixture.json')));
const sorted=[...fixture.businesses].sort((a,b)=>a.id.localeCompare(b.id));
const first=sorted.find(b=>fixture.menus[b.id].menu[0].optionGroups.length)||sorted[0],firstProduct=fixture.menus[first.id].menu[0];
const second=sorted.find(b=>b.id!==first.id),secondProduct=fixture.menus[second.id].menu[0];
async function main(){
 const log=fs.openSync(path.join(out,'ui-review-server.log'),'w'),server=spawn(process.execPath,['qa/dish-review-server.cjs'],{cwd:root,env:{...process.env,DISH_REVIEW_PORT:'3200'},stdio:['ignore',log,log],windowsHide:true});let browser;
 const shots=[],results=[];
 try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/comprar/restaurantes')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,600));}assert(ready,'Local server did not start');
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  for(const width of [320,390,768,1440]){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];let writes=0;
   page.setDefaultTimeout(25000);page.on('pageerror',error=>errors.push(error.message));
   await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==base)return route.abort();if(request.method()!=='GET'&&request.method()!=='HEAD'&&url.pathname!=='/api/metricas'){writes++;return route.abort();}return route.continue();});
   await context.addInitScript(()=>{if(!localStorage.getItem('mercau.buyer.destination.v1'))localStorage.setItem('mercau.buyer.destination.v1',JSON.stringify({municipality:'Nechí',source:'manual'}));});
   await page.goto(base+'/comprar/restaurantes');await page.locator('.dish-card').first().waitFor();await page.evaluate(()=>document.fonts.ready);
   await page.waitForTimeout(500);assert.equal(await page.locator('.dish-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width<640?2:width<1000?3:4);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   async function shot(name,fullPage=false){const file=`${name}-${width}.png`;await page.screenshot({path:path.join(out,file),fullPage});shots.push({file,name,width,fullPage});}
   await shot('01-platos');await shot('01-platos-completa',true);
   await page.getByRole('button',{name:'Restaurantes',exact:true}).click();await page.getByRole('heading',{name:'Elige un negocio'}).waitFor();
   await page.goBack();await page.locator('.dish-card').first().waitFor();assert(!new URL(page.url()).searchParams.has('vista'));
   await page.goForward();await page.getByRole('heading',{name:'Elige un negocio'}).waitFor();await page.getByRole('button',{name:'Platos',exact:true}).click();await page.locator('.dish-card').first().waitFor();
   await page.getByRole('button',{name:`Personalizar ${firstProduct.name} de ${first.name}`,exact:true}).click();
   const editor=page.getByRole('dialog',{name:firstProduct.name,exact:true});await editor.waitFor();
   assert.equal((await editor.locator('.dish-product-restaurant').innerText()).replace(/\s+/g,' '),`${first.name} · Ver menú`);
   assert((await editor.getByRole('link',{name:'Ver menú'}).getAttribute('href')).includes(first.id));
   const missing=firstProduct.optionGroups.some(g=>g.required&&!g.choices.some(c=>c.defaultSelected));
   if(missing){await editor.getByRole('button',{name:/^Agregar ·/}).click();await editor.getByRole('alert').waitFor();assert.equal(await page.evaluate(id=>sessionStorage.getItem(`mercau:catalog-cart:${id}:v1`),first.id),null);}
   async function selectRequired(product){
    for(let index=0;index<product.optionGroups.length;index++){const group=product.optionGroups[index],count=group.required?Math.max(1,group.minSelections):group.minSelections;
     for(const choice of group.choices.slice(0,count)){const field=editor.locator('fieldset').nth(index);const input=field.locator('label').filter({hasText:choice.name}).locator('input');if(!await input.isChecked())await input.check();}
    }
   }
   await selectRequired(firstProduct);
   const extraGroup=firstProduct.optionGroups.findIndex(g=>!g.required&&g.choices.some(c=>c.priceDelta>0&&!c.defaultSelected));
   if(extraGroup>=0){const choice=firstProduct.optionGroups[extraGroup].choices.find(c=>c.priceDelta>0&&!c.defaultSelected);await editor.locator('fieldset').nth(extraGroup).locator('label').filter({hasText:choice.name}).locator('input').check();}
   await editor.locator('.pilot-quantity button').last().click();await editor.getByRole('textbox').fill('Prueba local: no enviar.');
   await editor.evaluate(element=>{element.scrollTop=0;});await shot('02-personalizacion');
   const amount=await editor.getByRole('button',{name:/^Agregar ·/}).innerText();await editor.getByRole('button',{name:/^Agregar ·/}).click();
   await page.getByRole('heading',{name:`¿Algo más de ${first.name}?`,exact:true}).waitFor();await page.waitForTimeout(350);
   const stored=JSON.parse(await page.evaluate(id=>sessionStorage.getItem(`mercau:catalog-cart:${id}:v1`),first.id));assert.equal(stored[0].quantity,2);assert.equal(stored[0].productId,firstProduct.id);
   const selectedCost=firstProduct.optionGroups.reduce((sum,g)=>sum+g.choices.filter(c=>stored[0].selections.find(s=>s.groupId===g.id)?.choiceIds.includes(c.id)).reduce((n,c)=>n+c.priceDelta,0),0);
   const expected=(firstProduct.price+selectedCost)*2;assert(amount.includes(new Intl.NumberFormat('es-CO').format(expected)));
   const bar=page.locator('.pilot-mobile-cart');assert((await bar.getAttribute('aria-label')).includes('subtotal de productos'));assert((await bar.innerText()).includes(new Intl.NumberFormat('es-CO').format(expected)));
   assert(await bar.evaluate(e=>{const r=e.getBoundingClientRect(),n=document.querySelector('.buyer-bottom').getBoundingClientRect();return r.bottom<=n.top&&r.height>=44;}));
   await shot('03-agregado');await shot('03-agregado-completa',true);
   await page.getByRole('button',{name:'Entrar o crear cuenta para continuar',exact:true}).click();await page.getByRole('heading',{name:'Entra para hacer tu pedido',exact:true}).waitFor();assert(await page.locator('.pilot-login').isVisible());
   await page.getByRole('button',{name:'Volver a explorar',exact:true}).click();await page.locator('.dish-card').first().waitFor();
   assert(await page.getByRole('link',{name:`Ver pedido en ${first.name}`}).isVisible());
   await page.getByRole('link',{name:`Ver pedido en ${first.name}`}).click();await page.locator('.pilot-cart-line').waitFor();assert.deepEqual(JSON.parse(await page.evaluate(id=>sessionStorage.getItem(`mercau:catalog-cart:${id}:v1`),first.id)),stored);
   await page.getByRole('button',{name:'Volver a explorar',exact:true}).click();await page.locator('.dish-card').first().waitFor();
   await page.getByRole('button',{name:`Personalizar ${secondProduct.name} de ${second.name}`,exact:true}).click();
   const otherEditor=page.getByRole('dialog',{name:secondProduct.name,exact:true});await otherEditor.waitFor();
   for(let i=0;i<secondProduct.optionGroups.length;i++){const g=secondProduct.optionGroups[i];for(const c of g.choices.slice(0,g.required?Math.max(1,g.minSelections):g.minSelections)){const input=otherEditor.locator('fieldset').nth(i).locator('label').filter({hasText:c.name}).locator('input');if(!await input.isChecked())await input.check();}}
   await otherEditor.getByRole('button',{name:/^Agregar ·/}).click();const warning=page.getByRole('dialog',{name:`Tu carrito tiene productos de ${first.name}.`,exact:true});await warning.waitFor();
   await shot('04-cambio-restaurante');await warning.getByRole('button',{name:'Conservar mi carrito',exact:true}).click();assert.deepEqual(JSON.parse(await page.evaluate(id=>sessionStorage.getItem(`mercau:catalog-cart:${id}:v1`),first.id)),stored);
   await otherEditor.getByRole('button',{name:/^Agregar ·/}).click();await warning.waitFor();await warning.getByRole('button',{name:'Cerrar aviso y conservar carrito'}).click();assert.deepEqual(JSON.parse(await page.evaluate(id=>sessionStorage.getItem(`mercau:catalog-cart:${id}:v1`),first.id)),stored);
   await otherEditor.getByRole('button',{name:/^Agregar ·/}).click();await warning.waitFor();await warning.getByRole('button',{name:'Iniciar nuevo pedido',exact:true}).click();await otherEditor.waitFor({state:'hidden'});
   assert.equal(await page.evaluate(id=>sessionStorage.getItem(`mercau:catalog-cart:${id}:v1`),first.id),null);
   assert.equal(JSON.parse(await page.evaluate(id=>sessionStorage.getItem(`mercau:catalog-cart:${id}:v1`),second.id))[0].productId,secondProduct.id);
   await page.locator('.pilot-cart-line .pilot-quantity button').last().click();assert.equal(JSON.parse(await page.evaluate(id=>sessionStorage.getItem(`mercau:catalog-cart:${id}:v1`),second.id))[0].quantity,2);
   await page.locator('.pilot-cart-line .pilot-quantity button').first().click();await page.locator('.pilot-cart-line .pilot-quantity button').first().click();assert.equal(await page.evaluate(id=>sessionStorage.getItem(`mercau:catalog-cart:${id}:v1`),second.id),null);
   await page.getByRole('button',{name:'Volver a explorar',exact:true}).click();await page.locator('.dish-card').first().waitFor();
   await page.getByRole('textbox',{name:'Busca un plato o restaurante'}).fill('imposible-no-existe');await page.getByRole('button',{name:'Buscar platos y restaurantes'}).click();await page.getByRole('heading',{name:'No encontramos platos disponibles'}).waitFor();
   await page.goBack();await page.locator('.dish-card').first().waitFor();
   const section=fixture.menus[first.id].menu[0].category;await page.getByRole('button',{name:section,exact:true}).click();await page.waitForTimeout(250);assert.equal(new URL(page.url()).searchParams.get('platosCategoria'),section);
   await page.reload();await page.waitForTimeout(250);assert.equal(new URL(page.url()).searchParams.get('platosCategoria'),section);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mercau.buyer.destination.v1')).municipality),'Nechí');
   await page.getByRole('button',{name:'Todos',exact:true}).click();await page.locator('.dish-card').first().waitFor();const initialCount=await page.locator('.dish-card').count();await page.getByRole('button',{name:'Ver más platos',exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('.dish-card').length>n,initialCount);
   assert.equal(writes,0);assert.deepEqual(errors,[]);results.push({width,passed:true,realPublicSnapshot:true,isolatedAdapter:true,physicalDevice:false,operationalWrites:writes});await context.close();
  }
  const regression=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'}),regressionPage=await regression.newPage();let failOnce=true;
  await regression.addInitScript(()=>localStorage.setItem('mercau.buyer.destination.v1',JSON.stringify({municipality:'Nechí',source:'manual'})));
  await regression.route('**/*',route=>{if(new URL(route.request().url()).origin!==base)return route.abort();return route.continue();});
  await regression.route('**/api/comprar/platos?*',route=>{if(failOnce){failOnce=false;return route.fulfill({status:503,json:{error:'Fallo ficticio de red'}});}return route.continue();});
  const required={id:'11111111-1111-4111-8111-111111111111',name:'Acompañamiento ficticio de prueba',type:'single',required:true,minSelections:1,maxSelections:1,choices:[{id:'22222222-2222-4222-8222-222222222222',name:'Opción ficticia',priceDelta:0,defaultSelected:false}]};
  await regression.route('**/api/piloto/restaurante?*',route=>{const url=new URL(route.request().url()),menu=fixture.menus[url.searchParams.get('restaurant')];if(url.searchParams.get('mode')==='menu'&&menu)return route.fulfill({json:{...menu,menu:menu.menu.map(p=>({...p,optionGroups:[required]}))}});return route.continue();});
  await regressionPage.goto(base+'/comprar/restaurantes');await regressionPage.getByRole('button',{name:'Intentar nuevamente',exact:true}).click();await regressionPage.locator('.dish-card').first().waitFor();await regressionPage.locator('.dish-card button').first().click();
  const requiredEditor=regressionPage.locator('.pilot-customizer');await requiredEditor.waitFor();await requiredEditor.getByRole('button',{name:/^Agregar ·/}).click();await requiredEditor.getByRole('alert').waitFor();assert.equal(await regressionPage.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('mercau:catalog-cart:')).length),0);
  await requiredEditor.getByLabel('Opción ficticia',{exact:true}).check();await requiredEditor.getByRole('button',{name:/^Agregar ·/}).click();await regressionPage.getByText('Agregado a tu pedido',{exact:true}).waitFor();
  results.push({test:'required-selection-and-error-retry',passed:true,syntheticOptionForValidationOnly:true,includedInGallery:false});await regression.close();
  const reference='G:/Mi unidad/2. Financial Solidity S.A.S/FS HOLDINGS/Mercaáu.co/Nueva carpeta/Mercáu_ compra local, antojos colombianos.png';
  const img=file=>'data:image/png;base64,'+fs.readFileSync(file).toString('base64');
  const html='<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mercáu · Descubrir platos · Revisión local</title><style>body{font:16px Arial,sans-serif;color:#17191f;margin:24px;background:#fff}h1{color:#e21412}.gallery{display:flex;gap:20px;overflow:auto;align-items:flex-start;padding-bottom:22px}figure{margin:0;flex-shrink:0}img{display:block;max-width:100%;border:1px solid #eee}figcaption{font-size:13px;margin:8px 0}.reference{max-width:1300px}.shot{width:390px}.wide{width:900px}section{margin:32px 0}a{color:#b71513}</style><h1>Mercáu · Descubrir platos antes del restaurante</h1><p>Propuesta local, no publicada. Precios, fotografías y productos públicos capturados el '+fixture.capturedAt+'. Componentes funcionales actuales; consultas servidas por adaptador local de solo lectura, sin cuentas, pedidos, push ni Shipday. Chrome emulado en 320, 390, 768 y 1440 px; no celulares físicos.</p><h2>Maqueta de referencia: ilustrativa</h2>'+(fs.existsSync(reference)?'<img class="reference" alt="Maqueta ilustrativa proporcionada" src="'+img(reference)+'">':'<p>Archivo de referencia no disponible al generar esta galería.</p>')+['01-platos','02-personalizacion','03-agregado','04-cambio-restaurante'].map(name=>'<section><h2>'+name+'</h2><div class="gallery">'+shots.filter(s=>s.name===name).map(s=>'<figure class="'+(s.width>390?'wide':'shot')+'"><figcaption>'+s.width+' px · viewport</figcaption><img alt="'+s.name+' a '+s.width+' px" src="'+img(path.join(out,s.file))+'"></figure>').join('')+'</div></section>').join('')+'<h2>Capturas de página completa</h2><div class="gallery">'+shots.filter(s=>s.fullPage&&s.width<=390).map(s=>'<figure class="shot"><figcaption>'+s.name+' · '+s.width+' px</figcaption><img alt="'+s.name+'" src="'+img(path.join(out,s.file))+'"></figure>').join('')+'</div></html>';
  fs.writeFileSync(path.join(out,'galeria-platos.html'),html);console.log(JSON.stringify(results));
 }finally{if(browser)await browser.close();if(process.platform==='win32')spawnSync('taskkill',['/pid',String(server.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});else server.kill();fs.closeSync(log);fs.writeFileSync(path.join(out,'ui-results.json'),JSON.stringify(results,null,2));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
