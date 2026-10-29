const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const beforeRoot = process.env.BUYER_HOME_BEFORE;
const out = process.env.BUYER_HOME_OUTPUT || path.join(root, 'outputs/buyer-home-brand');
const businesses = [
 ['rec'+'Q'.repeat(14), 'Restaurante de prueba', 'Comidas y bebidas', '/presentation/category-food.webp'],
 ['rec'+'S'.repeat(14), 'Comercio de prueba', 'Moda y accesorios', '/presentation/category-shops.webp'],
 ['rec'+'T'.repeat(14), 'Cocina de prueba', 'Comidas y bebidas', '/presentation/category-food.webp'],
 ['rec'+'U'.repeat(14), 'Tienda de prueba', 'Moda y accesorios', '/presentation/category-shops.webp'],
].map(([id,name,category,photoUrl]) => ({id,name,category,photoUrl,municipality:'Nechí',description:'Datos ficticios de revisión visual.',hasCatalog:true,slug:id}));
const captures = [], checks = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function luminance(rgb) { return rgb.map(v => {v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0); }
function contrast(a,b) {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
async function main() {
 assert(beforeRoot, 'BUYER_HOME_BEFORE must point to the previously verified production export');
 fs.mkdirSync(out,{recursive:true});
 const env={...process.env};
 for(const key of Object.keys(env))if(/SUPABASE|NEXT_PUBLIC_|AIRTABLE|SHIPDAY|RESEND|VAPID|SECRET|API_KEY|OPENAI|META_|NODE_OPTIONS/.test(key))delete env[key];
 Object.assign(env,{NODE_ENV:'production',NEXT_DIST_DIR:'.next-pwa-build',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329'});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  for(const [version,cwd,port] of [['before',beforeRoot,3091],['after',root,3092]]) {
   const base='http://127.0.0.1:'+port;
   const log=fs.openSync(path.join(out,version+'-server.log'),'w');
   const server=spawn(process.execPath,['--require','./qa/local-only-network.cjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','-p',String(port)],{cwd,env,stdio:['ignore',log,log],windowsHide:true});
   try {
    let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await pause(500);}assert(ready);
    for(const width of [320,390,768,1440]) {
     const height=width<640?844:900;
     const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'});
     await context.addInitScript(()=>{
      if(!sessionStorage.getItem('home-review-initialized')){
       localStorage.setItem('mercau.buyer.destination.v1',JSON.stringify({municipality:'Nechí',source:'manual'}));
       sessionStorage.setItem('home-review-initialized','1');
      }
      window.__geoCalls=0;navigator.geolocation.getCurrentPosition=()=>{window.__geoCalls++;};
     });
     await context.route('**/*',route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin!==base)return route.abort();
      if(url.pathname==='/api/comprador/negocios')return route.fulfill({json:{businesses,preview:false}});
      if(request.method()!=='GET')return route.fulfill({status:204,body:''});
      return route.continue();
     });
     const page=await context.newPage();page.setDefaultTimeout(30000);const errors=[];
     page.on('pageerror',e=>errors.push(e.message));
     async function settle(){await page.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode().catch(()=>{}))));await page.evaluate(()=>document.fonts.ready);await pause(200);}
     async function capture(name,fullPage=false){await settle();const file=`${version}-${name}-${width}${fullPage?'-full':''}.png`;await page.screenshot({path:path.join(out,file),fullPage});captures.push({version,name,width,file,fullPage});}
     await page.goto(base+'/comprar',{waitUntil:'networkidle'});
     await page.locator('.buyer-business').last().waitFor();
     assert.equal(await page.locator('.buyer-business').count(),4);
     await capture('inicio');await capture('inicio',true);
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
     assert.equal(await page.evaluate(()=>window.__geoCalls),0);
     assert.equal(await page.locator('.buyer-gateways>a').nth(0).getAttribute('href'),'/comprar/restaurantes');
     assert.equal(await page.locator('.buyer-gateways>a').nth(1).getAttribute('href'),'/comprar/comercios');
     assert.equal(await page.getByRole('heading',{level:1}).textContent(),'¿Qué quieres pedir hoy?');
     if(version==='after') {
      assert(await page.locator('.buyer-home').count());
      assert.equal(await page.locator('.buyer-title h1 span').textContent(),'pedir hoy');
      assert.equal(await page.locator('.buyer-search button[type=submit]').getAttribute('aria-label'),'Buscar');
      const colors=await page.locator('.buyer-search button[type=submit]').evaluate(el=>({foreground:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
      assert.equal(colors.background,'rgb(226, 20, 18)');assert.equal(colors.foreground,'rgb(255, 255, 255)');
      assert(contrast([255,255,255],[226,20,18])>=4.5,'Button contrast');
      assert(contrast([226,20,18],[255,255,255])>=4.5,'Title contrast');
      assert(contrast([197,17,16],[255,233,233])>=4.5,'Active navigation contrast');
      const geometry=await page.locator('.buyer-search button,.buyer-destination,.buyer-category-rail a,.buyer-bottom a').evaluateAll(elements=>elements.map(el=>({name:el.getAttribute('aria-label')||el.textContent,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
      assert(geometry.every(g=>g.width>=44&&g.height>=44),'Touch target below 44 px: '+JSON.stringify(geometry));
      await page.getByRole('button',{name:'Buscar',exact:true}).focus();
      assert.equal(await page.locator('.buyer-search button[type=submit]').evaluate(el=>getComputedStyle(el).outlineWidth),'3px');
      await page.screenshot({path:path.join(out,`after-focus-${width}.png`)});
      const rail=page.locator('.buyer-category-rail');
      await rail.evaluate(el=>{el.scrollLeft=el.scrollWidth;});assert(await rail.evaluate(el=>el.scrollLeft>0));
      await rail.evaluate(el=>{el.scrollLeft=0;});
      await page.getByRole('button',{name:/Nechí.*Cambiar/}).click();
      await page.getByRole('button',{name:'Caucasia',exact:true}).click();await page.reload({waitUntil:'networkidle'});
      assert(await page.locator('.buyer-destination').textContent().then(t=>t.includes('Caucasia')));
      await page.getByRole('button',{name:/Caucasia.*Cambiar/}).click();await page.getByRole('button',{name:'Nechí',exact:true}).click();
      await page.getByRole('searchbox').count().then(async count=>{if(count)await page.getByRole('searchbox').fill('Cocina');else await page.getByRole('textbox',{name:'Busca un negocio o producto'}).fill('Cocina');});
      await page.getByRole('button',{name:'Buscar',exact:true}).click();assert.equal(await page.locator('.buyer-business').count(),1);
      assert(await page.locator('.buyer-results').evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('.buyer-header').getBoundingClientRect().bottom-2));
      await page.getByRole('button',{name:'Borrar búsqueda',exact:true}).click();assert.equal(await page.locator('.buyer-business').count(),4);
      const last=page.locator('.buyer-business').last().getByRole('link').last();await last.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
      assert(await last.evaluate(el=>{const b=el.getBoundingClientRect(),n=document.querySelector('.buyer-bottom').getBoundingClientRect(),h=document.querySelector('.buyer-header').getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return b.bottom<=n.top+1&&b.top>=h.bottom-1&&(hit===el||el.contains(hit));}),'Navigation covers final action');
      checks.push({width,touchTargets:true,contrast:true,focus:true,noOverflow:true,locationPersists:true,search:true,lastActionReachable:true});
     }
     if(width===390){
      for(const section of ['restaurantes','comercios','cuenta','pedidos']) {
       await page.goto(base+'/comprar/'+section,{waitUntil:'networkidle'});await settle();
       assert.equal(await page.locator('.buyer-home').count(),0);
       const file=`${version}-unchanged-${section}.png`;await page.screenshot({path:path.join(out,file),fullPage:true});
       if(version==='after')assert(fs.readFileSync(path.join(out,file)).equals(fs.readFileSync(path.join(out,`before-unchanged-${section}.png`))),'Other screen visually changed: '+section);
      }
      await page.goto(base+'/comprar',{waitUntil:'networkidle'});await page.evaluate(()=>localStorage.removeItem('mercau.buyer.destination.v1'));await page.reload({waitUntil:'networkidle'});
      await page.getByRole('button',{name:'Elegir municipio',exact:true}).waitFor();await capture('sin-destino');
      if(version==='after')assert.equal(await page.evaluate(()=>window.__geoCalls),0);
      await context.addInitScript(()=>{Object.defineProperty(navigator,'standalone',{get:()=>true,configurable:true});});
      await page.goto(base+'/comprar/restaurantes');await page.goto(base+'/comprar');await page.locator('.buyer-header').waitFor();await settle();
      assert.equal(await page.getByRole('link',{name:'Portada',exact:true}).count(),0);await capture('pwa-emulada');
     }
     assert.deepEqual(errors,[]);await context.close();
    }
   } finally {server.kill();fs.closeSync(log);}
  }
 } finally {await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({simulatedData:true,physicalDevices:false,captures,checks},null,2));}
 const imageTag=c=>`<img loading="lazy" alt="${c.version} ${c.name} ${c.width} px" src="data:image/png;base64,${fs.readFileSync(path.join(out,c.file)).toString('base64')}">`;
 const rows=[];
 for(const width of [320,390,768,1440]){const pair=captures.filter(c=>c.name==='inicio'&&c.width===width&&!c.fullPage);rows.push(`<section><h2>Inicio · ${width} px</h2><div class="pair">${pair.map(c=>`<figure><figcaption>${c.version==='before'?'Antes':'Propuesta local'}</figcaption>${imageTag(c)}</figure>`).join('')}</div></section>`);}
 for(const name of ['sin-destino','pwa-emulada']){rows.push(`<section><h2>${name==='sin-destino'?'Entrada sin destino':'Modo instalado emulado'} · 390 px</h2><div class="pair">${captures.filter(c=>c.name===name).map(c=>`<figure><figcaption>${c.version==='before'?'Antes':'Propuesta local'}</figcaption>${imageTag(c)}</figure>`).join('')}</div></section>`);}
 rows.push(`<details><summary>Capturas de página completa</summary>${captures.filter(c=>c.name==='inicio'&&c.fullPage&&c.width<640).map(c=>`<figure><figcaption>${c.version} · ${c.width} px</figcaption>${imageTag(c)}</figure>`).join('')}</details>`);
 fs.writeFileSync(path.join(out,'buyer-home-brand-review.html'),`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mercáu · Propuesta local del Inicio</title><style>body{font-family:Arial,sans-serif;color:#191b20;background:#f8f8f8;margin:0;padding:24px}h1{font-size:26px}h2{font-size:20px}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;align-items:start}section{margin:32px 0}figure{margin:0;min-width:0}figcaption{font-weight:bold;padding:10px 0}img{display:block;width:100%;max-width:720px;height:auto;border:1px solid #ddd}details img{max-width:390px}summary{cursor:pointer;padding:16px;background:white}p{max-width:850px;line-height:1.5}@media(max-width:600px){body{padding:12px}.pair{gap:8px}}</style><h1>Mercáu · Inicio del comprador</h1><p>Propuesta local, sin publicar. Mismos datos ficticios en antes y después. Capturas emuladas, no pruebas en dispositivos físicos. Sin cambios de pedidos, pagos o logística. Fotografías de acceso ilustrativas reutilizadas de la portada aprobada.</p>${rows.join('')}</html>`);
 console.log(JSON.stringify({out,checks,unchangedScreens:['restaurantes','comercios','cuenta','pedidos'],gallery:'buyer-home-brand-review.html'}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
