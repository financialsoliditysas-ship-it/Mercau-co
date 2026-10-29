const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.env.MERCAU_IMAGE_CANDIDATE||path.resolve(__dirname,'..'),base='http://127.0.0.1:3096',out=process.env.MERCAU_IMAGE_OUTPUT||path.join(root,'outputs/catalog-image-ui');
const restaurant='rec'+'Q'.repeat(14),product='00000000-0000-4000-8000-000000000100';
async function main(){
 fs.mkdirSync(out,{recursive:true});assert(fs.existsSync(process.env.MERCAU_QA_IMAGE),'Public sample must be saved locally');
 const env={...process.env};for(const key of Object.keys(env))if(/SUPABASE|NEXT_PUBLIC_|AIRTABLE|SHIPDAY|RESEND|VAPID|SECRET|API_KEY|OPENAI|META_|NODE_OPTIONS/.test(key))delete env[key];
 Object.assign(env,{NODE_ENV:'production',MERCAU_NAVIGATION_TEST:'1',MERCAU_INTEGRAL_TEST:'1',MERCAU_IMAGE_TEST:'1',NEXT_DIST_DIR:'.next-pwa-build',AIRTABLE_API_KEY:'qa-not-a-real-key',AIRTABLE_BASE_ID:'qa-navigation',AIRTABLE_NEGOCIOS_TABLE_ID:'businesses',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',SUPABASE_SERVICE_ROLE_KEY:'qa-not-a-real-key'});
 const log=fs.openSync(path.join(out,'server.log'),'w'),server=spawn(process.execPath,['--require',path.join(__dirname,'catalog-image-fixtures.cjs'),path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','-p','3096'],{cwd:root,env,stdio:['ignore',log,log],windowsHide:true});
 const results={simulatedServices:true,physicalDevice:false,ordersCreated:0,screens:[],network:[]};let browser;
 try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready);
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  for(const width of [320,390,768,1440]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   await context.route('**/*',route=>new URL(route.request().url()).origin!==base?route.abort():route.request().method()!=='GET'?route.fulfill({status:204,body:''}):route.continue());
   const page=await context.newPage();page.setDefaultTimeout(45000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+'/negocios/restaurante-qa-ficticio/catalogo',{waitUntil:'networkidle'});
   const images=page.locator('.pilot-menu img');await images.first().waitFor();assert.equal(await images.count(),8);
   await images.first().evaluate(img=>img.decode());
   assert(await images.first().evaluate(img=>img.currentSrc.includes('w=320')));
   assert.equal(await images.nth(0).getAttribute('loading'),'eager');assert.equal(await images.nth(2).getAttribute('loading'),'lazy');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:path.join(out,`menu-${width}.png`)});
   await page.goto(base+'/negocios/comercio-qa-ficticio/catalogo',{waitUntil:'networkidle'});await page.getByRole('img',{name:'Foto de Producto QA 1',exact:true}).evaluate(img=>img.decode());
   assert.equal(await page.locator('img[srcset]').count(),8);assert.deepEqual(errors,[]);
   results.screens.push({width,menuAndCatalogRender:true,thumbnails:true,lazyBelow:true,noOverflow:true});await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();
  await context.route('**/*',route=>new URL(route.request().url()).origin===base&&route.request().method()==='GET'?route.continue():route.abort());
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1500000/8,uploadThroughput:750000/8});
  for(const suffix of ['', '&w=320']){
   const url=`${base}/api/negocios/${restaurant}/catalogo/${product}/foto?v=1${suffix}`,start=performance.now();
   const responsePromise=page.waitForResponse(response=>response.url()===url);
   await page.setContent(`<img src="${url}" alt="Muestra local">`);await page.getByRole('img').evaluate(img=>img.decode());
   const response=await responsePromise,bytes=(await response.body()).length;assert.equal(response.status(),200);
   results.network.push({variant:suffix?'thumbnail320':'original',ms:Math.round(performance.now()-start),bytes,emulatedMegabits:1.5,emulatedLatencyMs:150});
  }
  const image=await context.request.get(`${base}/api/negocios/${restaurant}/catalogo/${product}/foto?w=320`,{headers:{Accept:'image/webp'}}),etag=image.headers().etag;
  assert.equal((await context.request.get(`${base}/api/negocios/${restaurant}/catalogo/${product}/foto?w=320`,{headers:{Accept:'image/webp','If-None-Match':etag}})).status(),304);
  assert.equal((await context.request.get(`${base}/api/negocios/${restaurant}/catalogo/${product}/foto?w=1000000`)).status(),400);
  assert(results.network[1].bytes<results.network[0].bytes*.3);results.conditional304=true;await context.close();
  console.log(JSON.stringify(results));
 }finally{if(browser)await browser.close();server.kill();fs.closeSync(log);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
