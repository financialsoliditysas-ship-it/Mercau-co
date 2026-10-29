const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {businesses}=require('./presentation-navigation-fixtures.cjs');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:3084',out=path.join(root,'outputs/presentation-navigation');
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const env={...process.env};
  for(const key of Object.keys(env))if(/SUPABASE|NEXT_PUBLIC_|AIRTABLE|SHIPDAY|RESEND|VAPID|SECRET|API_KEY|OPENAI|META_/.test(key))delete env[key];
  Object.assign(env,{NODE_ENV:'development',MERCAU_NAVIGATION_TEST:'1',MERCAU_PRESENTATION_REVIEW:'1',MERCAU_BUYER_PREVIEW:'0',NEXT_TELEMETRY_DISABLED:'1',NEXT_DIST_DIR:'.next-presentation-navigation',AIRTABLE_API_KEY:'qa-not-a-real-key',AIRTABLE_BASE_ID:'qa-navigation',AIRTABLE_NEGOCIOS_TABLE_ID:'businesses',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',SUPABASE_SERVICE_ROLE_KEY:'qa-not-a-real-key'});
  const log=fs.openSync(path.join(out,'server.log'),'w');
  const app=spawn(process.execPath,['--require',path.join(root,'qa/presentation-navigation-fixtures.cjs'),'node_modules/next/dist/bin/next','dev','-p','3084','--hostname','127.0.0.1'],{cwd:root,env,stdio:['ignore',log,log],windowsHide:true});
  let browser;const results=[];
  try{
    let ready=false;for(let i=0;i<90;i++){try{if((await fetch(base+'/presentacion-revision',{signal:AbortSignal.timeout(5000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}
    assert(ready,'QA server not ready');
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    for(const width of [390,1440])for(const anchors of [false,true])for(const [i,kind]of ['restaurantes','comercios'].entries()){
      const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
      page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==base)return r.abort();if(r.request().method()!=='GET')return r.fulfill({status:403,body:'QA: writes blocked'});return r.continue();});
      await page.goto(base+'/presentacion-revision',{waitUntil:'networkidle'});
      if(anchors)for(const id of ['como-funciona','cobertura','para-negocios','instalar']){
        if(width===390){await page.getByRole('button',{name:'Abrir menú',exact:true}).click();await page.locator('#p-mobile-menu a[href="#'+id+'"]').click();}
        else await page.locator('.p-desktop-nav a[href="#'+id+'"]').click();
        await page.waitForURL(base+'/presentacion-revision#'+id);
        await page.waitForFunction(id=>{const section=document.getElementById(id).getBoundingClientRect(),header=document.querySelector('.p-header').getBoundingClientRect();return section.top>=header.bottom-1&&section.top<innerHeight;},id);
      }
      const presentationUrl=page.url(),anchorState=await page.evaluate(()=>({hasTree:Boolean(history.state?.__PRIVATE_NEXTJS_INTERNALS_TREE),appRouter:Boolean(history.state?.__NA)}));
      await page.locator('.p-category-'+(i?'shops':'food')).click();await page.waitForURL(base+'/comprar/'+kind);
      await page.getByRole('heading',{name:i?'Comercios':'Restaurantes',exact:true}).waitFor();
      const business=page.locator('.buyer-business').filter({hasText:businesses[i].name});await business.waitFor();
      await business.getByRole('link',{name:i?'Ver catálogo':'Ver menú',exact:true}).click();
      const catalogUrl=base+'/negocios/'+businesses[i].slug+'/catalogo';await page.waitForURL(catalogUrl);
      await page.getByRole('heading',{name:businesses[i].name,exact:true}).waitFor();await page.getByRole('heading',{name:i?'Producto QA ficticio':'Plato QA ficticio',exact:true}).waitFor();
      await page.goBack();await page.waitForURL(base+'/comprar/'+kind);await page.getByRole('heading',{name:i?'Comercios':'Restaurantes',exact:true}).waitFor();
      await page.goBack();await page.waitForURL(presentationUrl);await page.locator('.p-hero h1').waitFor();
      assert.equal(await page.locator('.buyer-app').count(),0,'URL returned but buyer remained rendered');
      if(anchors){await page.goBack();await page.waitForURL(base+'/presentacion-revision#para-negocios');await page.locator('.p-hero h1').waitFor();await page.goForward();await page.waitForURL(presentationUrl);await page.locator('.p-hero h1').waitFor();}
      await page.goForward();await page.waitForURL(base+'/comprar/'+kind);await page.getByRole('heading',{name:i?'Comercios':'Restaurantes',exact:true}).waitFor();
      await page.goForward();await page.waitForURL(catalogUrl);await page.getByRole('heading',{name:businesses[i].name,exact:true}).waitFor();
      assert.deepEqual(errors,[]);results.push({width,anchors,kind,anchorState,back:true,forward:true,realRouteComponents:true,fakeServiceResponses:true,physicalDevice:false});
      await context.close();
    }
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
  }catch(e){fs.writeFileSync(path.join(out,process.argv.includes('--expect-failure')?'before-failure.json':'failure.json'),JSON.stringify({message:e.message,completed:results},null,2));throw e;}
  finally{if(browser)await browser.close();app.kill();fs.closeSync(log);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
