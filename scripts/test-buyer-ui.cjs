const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://localhost:3057';
const captures=[];
async function capture(page,name,width){
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode().catch(()=>{}))));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});resolve();}))));
  await page.waitForFunction(()=>window.scrollY===0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Horizontal overflow');
  assert.equal(await page.locator('img').evaluateAll(images=>images.filter(i=>!i.complete||!i.naturalWidth).length),0);
  for(const type of ['viewport','full']){
    const path='buyer-'+name+'-'+width+'-'+type+'.png';
    await page.screenshot({path:'outputs/'+path,fullPage:type==='full'});
    if(type==='viewport')assert.equal(await page.evaluate(()=>window.scrollY),0,'Screenshot moved away from page start: '+name);
    captures.push({name,width,type,path});
  }
}
async function verifyReachable(page){
  const actions=page.locator('.buyer-business a, .buyer-business button, .buyer-commercial-preview, .buyer-shortcuts a, .buyer-gateways>a');
  for(let i=0;i<await actions.count();i++){
    const target=actions.nth(i);
    await target.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    const geometry=await target.evaluate(el=>{
      const box=el.getBoundingClientRect();
      const header=document.querySelector('.buyer-header').getBoundingClientRect();
      const nav=document.querySelector('.buyer-bottom').getBoundingClientRect();
      const hit=document.elementFromPoint(box.left+box.width/2,box.top+box.height/2);
      return {clear:box.top>=header.bottom-1&&box.bottom<=nav.top+1,hit:el===hit||el.contains(hit),top:box.top,bottom:box.bottom,header:header.bottom,nav:nav.top,text:el.textContent,hitTag:hit?.tagName};
    });
    if(!geometry.clear||!geometry.hit)await page.screenshot({path:'outputs/buyer-nav-failure.png'});
    assert(geometry.clear&&geometry.hit,'Fixed navigation covered action '+i+' '+JSON.stringify(geometry));
  }
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  const bottom=await page.locator('.buyer-business').last().evaluate(el=>({card:el.getBoundingClientRect().bottom,nav:document.querySelector('.buyer-bottom').getBoundingClientRect().top}));
  assert(bottom.card<=bottom.nav,'Last card must be reachable above navigation');
}
(async()=>{
  fs.mkdirSync('outputs',{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    for(const width of process.env.BUYER_TEST_WIDTHS?process.env.BUYER_TEST_WIDTHS.split(',').map(Number):[320,390,768,1440]){
      const context=await browser.newContext({viewport:{width,height:width===390?667:900},geolocation:{latitude:6.2442,longitude:-75.5812},permissions:['geolocation']});
      await context.addInitScript(()=>{
        window.__geoCalls=0;
        const original=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
        navigator.geolocation.getCurrentPosition=(...args)=>{window.__geoCalls++;original(...args);};
      });
      const page=await context.newPage();const errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.setDefaultNavigationTimeout(90000);
      await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
      await page.goto(base+'/comprar',{waitUntil:'networkidle'});
      await page.getByText('Asados de prueba',{exact:true}).waitFor();
      assert.equal(await page.locator('.buyer-business').count(),6);
      assert.equal(await page.evaluate(()=>window.__geoCalls),0,'GPS called on initial load');
      assert(await page.getByRole('button',{name:'Usar mi ubicación',exact:true}).isVisible());
      assert(await page.getByRole('button',{name:'Elegir municipio',exact:true}).isVisible());
      assert.equal(await page.locator('.buyer-shortcuts a').count(),4);
      assert.equal(await page.locator('.buyer-category-options').count(),0);
      const shortcuts=await page.locator('.buyer-shortcuts').evaluate(el=>({bottom:el.getBoundingClientRect().bottom,nav:document.querySelector('.buyer-bottom').getBoundingClientRect().top}));
      if(shortcuts.bottom>shortcuts.nav)await page.screenshot({path:'outputs/buyer-shortcuts-failure.png'});
      assert(shortcuts.bottom<=shortcuts.nav,'Home shortcuts initially covered by navigation '+JSON.stringify(shortcuts));
      const sizes=await page.locator('.buyer-gateway-image').evaluateAll(items=>items.map(x=>({width:x.offsetWidth,height:x.offsetHeight})));
      assert.deepEqual(sizes[0],sizes[1]);
      const compact=await page.locator('.buyer-business.without-photo').first().boundingBox();
      const photo=await page.locator('.buyer-business:not(.without-photo)').first().boundingBox();
      assert(compact.height<photo.height);
      await capture(page,'home',width);await verifyReachable(page);
      await page.screenshot({path:'outputs/buyer-home-'+width+'-bottom.png'});
      captures.push({name:'home-bottom',width,type:'viewport',path:'buyer-home-'+width+'-bottom.png'});
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.getByRole('button',{name:'Elegir municipio',exact:true}).click();
      assert.equal(await page.evaluate(()=>window.__geoCalls),0,'Opening selector requested GPS');
      await capture(page,'destination',width);
      await page.getByRole('button',{name:'Nechí',exact:true}).click();
      await page.reload({waitUntil:'networkidle'});
      assert((await page.locator('.buyer-destination').innerText()).includes('Nechí'));
      assert.equal(await page.evaluate(()=>window.__geoCalls),0);
      await page.locator('.buyer-destination').click();
      await page.getByRole('button',{name:'Usar mi ubicación',exact:true}).click();
      await page.getByText('Ubicación obtenida.',{exact:false}).waitFor();
      assert.equal(await page.evaluate(()=>window.__geoCalls),1);
      assert((await page.evaluate(()=>localStorage.getItem('mercau.buyer.destination.v1'))).includes('Nechí'));
      await page.getByRole('button',{name:'Cerrar selección de destino'}).click();
      await page.getByRole('link',{name:'Restaurantes Comidas y bebidas'}).click();
      await page.waitForURL('**/comprar/restaurantes');
      await page.getByRole('heading',{name:'Restaurantes',exact:true}).waitFor();
      await page.getByText('Asados de prueba',{exact:true}).waitFor();
      assert.equal(await page.locator('.buyer-business').count(),2);
      await capture(page,'restaurants',width);await verifyReachable(page);
      await page.getByRole('textbox',{name:'Busca un negocio o producto'}).fill('Hamburguesas');
      await page.getByRole('button',{name:'Buscar',exact:true}).click();
      assert.equal(await page.locator('.buyer-business').count(),1);
      await page.getByRole('button',{name:'Guardar en favoritos: Hamburguesas de prueba'}).click();
      await page.goto(base+'/comprar/favoritos',{waitUntil:'networkidle'});
      assert.equal(await page.locator('.buyer-business').count(),1);
      await page.goto(base+'/comprar/comercios',{waitUntil:'networkidle'});
      await page.getByText('Tienda de prueba',{exact:true}).waitFor();
      assert.equal(await page.locator('.buyer-business').count(),4);
      assert.equal(await page.getByText('Ver servicios',{exact:true}).count(),1);
      await capture(page,'commerce',width);await verifyReachable(page);
      await page.goto(base+'/comprar/explorar',{waitUntil:'networkidle'});
      await page.getByText('Ficha sin catálogo',{exact:true}).waitFor();
      const empty=page.locator('[data-business-id="rec00000000000008"]');
      assert.equal(await empty.locator('.buyer-commercial,.buyer-commercial-preview').count(),0);
      for(const label of ['Ver menú','Ver catálogo','Ver servicios'])assert(await page.getByText(label,{exact:true}).count()>0);
      assert.equal(await page.locator('.buyer-category-options button').count(),11);
      await capture(page,'cta-variants',width);await verifyReachable(page);
      for(const type of ['tiendas','mercados','farmacias','servicios']){
        await page.goto(base+'/comprar/comercios?tipo='+type,{waitUntil:'networkidle'});
        await page.locator('.buyer-business').first().waitFor();
        assert.equal(await page.locator('.buyer-business').count(),1,'Quick filter '+type);
      }
      assert.deepEqual(errors,[]);
      await context.close();
      console.log('PASS '+width+'px: no automatic GPS, equal imagery, compact cards, CTA variants, shortcuts, fixed-nav reachability and viewport/full screenshots.');
    }
    const denied=await browser.newContext({viewport:{width:390,height:667}});
    await denied.addInitScript(()=>{window.__geoCalls=0;navigator.geolocation.getCurrentPosition=(_success,error)=>{window.__geoCalls++;error({code:1});};});
    const page=await denied.newPage();
    await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
    await page.goto(base+'/comprar',{waitUntil:'networkidle'});
    assert.equal(await page.evaluate(()=>window.__geoCalls),0);
    await page.getByRole('button',{name:'Usar mi ubicación',exact:true}).click();
    await page.getByText('No pudimos obtener tu ubicación.',{exact:false}).waitFor();
    await page.getByRole('button',{name:'Nechí',exact:true}).click();
    assert((await page.locator('.buyer-destination').innerText()).includes('Nechí'));
    await denied.close();
    fs.writeFileSync('outputs/buyer-visual-results.json',JSON.stringify({viewports:[...new Set(captures.map(c=>c.width))],deviceTests:false,gps:'simulated',captures},null,2));
    const gallery=captures.map(c=>'<figure><figcaption>'+c.width+' px · '+c.name+' · '+c.type+'</figcaption><a href="'+c.path+'"><img src="'+c.path+'" loading="lazy" alt="'+c.name+'"></a></figure>').join('');
    fs.writeFileSync('outputs/buyer-visual-review.html','<!doctype html><html lang="es"><meta charset="utf-8"><title>Mercáu: revisión visual local</title><style>body{font:15px system-ui;margin:24px;color:#20252d}h1{color:#d82016}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}img{max-width:100%;height:auto;border:1px solid #ddd}figure{margin:0}figcaption{margin:8px 0}</style><h1>Mercáu · Revisión visual</h1><p>Prueba local con datos ficticios. Tamaños emulados, no dispositivos reales. Viewport: pantalla visible. Full: página completa.</p><p><a href="http://localhost:3057/comprar">Abrir prueba</a></p><div class="gallery">'+gallery+'</div></html>');
    console.log('PASS GPS denial fallback; generated visual gallery. No production requests.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
