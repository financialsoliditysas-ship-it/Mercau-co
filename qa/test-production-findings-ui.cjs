const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:3088',out=path.join(root,'outputs/production-findings');
async function main(){
 fs.mkdirSync(out,{recursive:true});const env={...process.env};
 for(const key of Object.keys(env))if(/SUPABASE|NEXT_PUBLIC_|AIRTABLE|SHIPDAY|RESEND|VAPID|SECRET|API_KEY|OPENAI|META_|NODE_OPTIONS/.test(key))delete env[key];
 Object.assign(env,{NODE_ENV:'production',MERCAU_NAVIGATION_TEST:'1',MERCAU_INTEGRAL_TEST:'1',MERCAU_FINDINGS_TEST:'1',NEXT_DIST_DIR:'.next-pwa-build',AIRTABLE_API_KEY:'qa-not-a-real-key',AIRTABLE_BASE_ID:'qa-navigation',AIRTABLE_NEGOCIOS_TABLE_ID:'businesses',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',SUPABASE_SERVICE_ROLE_KEY:'qa-not-a-real-key'});
 const log=fs.openSync(path.join(out,'server.log'),'w'),server=spawn(process.execPath,['--require','./qa/findings-fixtures.cjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','-p','3088'],{cwd:root,env,stdio:['ignore',log,log],windowsHide:true});
 let browser;const results=[];
 try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready);
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  for(const width of [320,390,768,1440]){
   const context=await browser.newContext({viewport:{width,height:844},userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(30000);
   await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==base)return route.abort();if(route.request().method()!=='GET')return route.fulfill({status:204,body:''});return route.continue();});
   await page.goto(base,{waitUntil:'networkidle'});
   assert.equal(await page.locator('#instalar a[href="/instalar"]').count(),0);
   await page.evaluate(()=>{window.__promptCalls=0;const event=new Event('beforeinstallprompt');event.prompt=async()=>{window.__promptCalls++;};event.userChoice=Promise.resolve({outcome:'dismissed'});dispatchEvent(event);});
   await page.locator('#instalar').getByRole('button',{name:'Instalar Mercáu',exact:true}).click();assert.equal(await page.evaluate(()=>window.__promptCalls),1);assert.equal(new URL(page.url()).pathname,'/');
   await page.locator('#instalar').getByRole('button',{name:'Instalar Mercáu',exact:true}).click();await page.getByRole('dialog',{name:'Instala Mercáu en tu celular',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/');await page.getByRole('button',{name:'Cerrar instrucciones',exact:true}).click();
   await page.goto(base+'/comprar',{waitUntil:'networkidle'});await page.getByRole('link',{name:'Portada',exact:true}).click();await page.locator('.p-hero').waitFor();
   await page.goto(base+'/negocios/restaurante-qa-ficticio/catalogo',{waitUntil:'networkidle'});const nav=page.getByRole('navigation',{name:'Categorias del menu',exact:true});await nav.waitFor();await nav.evaluate(el=>el.scrollIntoView({block:'start'}));
   const article=page.locator('[data-menu-category="Asados"]').first();await article.waitFor();await article.evaluate(el=>{const nav=document.querySelector('.pilot-categories');window.scrollTo({top:window.scrollY+el.getBoundingClientRect().top-nav.getBoundingClientRect().height,behavior:'instant'});});
   await page.waitForFunction(()=>document.querySelector('.pilot-categories button[data-category="Asados"]')?.getAttribute('aria-pressed')==='true');
   assert(Math.abs(await nav.evaluate(el=>el.getBoundingClientRect().top))<3,'Category bar must remain pinned');assert.equal(await page.locator('.pilot-menu article').count(),15,'Scroll spy must not filter products');
   await nav.getByRole('button',{name:'Bebidas',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.pilot-menu article').length===5);assert.equal(await page.locator('.pilot-menu article:not([data-menu-category="Bebidas"])').count(),0);
   results.push({width,directPrompt:true,helpInline:true,publicHomeLink:true,stickyCategories:true,scrollSpyDoesNotFilter:true,manualFilterPreserved:true,physicalDevice:false});await context.close();
  }
  const installed=await browser.newContext({viewport:{width:390,height:844}});await installed.addInitScript(()=>{const original=window.matchMedia.bind(window);window.matchMedia=query=>{const media=original(query);if(query==='(display-mode: standalone)')Object.defineProperty(media,'matches',{value:true});return media;};});const app=await installed.newPage();await app.goto(base+'/comprar');await app.locator('.buyer-header').waitFor();await app.waitForTimeout(500);assert.equal(await app.getByRole('link',{name:'Portada',exact:true}).count(),0);await installed.close();
  console.log(JSON.stringify(results));
 }finally{if(browser)await browser.close();server.kill();fs.closeSync(log);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
