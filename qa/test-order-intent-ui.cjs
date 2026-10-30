const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:3178',out=path.join(root,'outputs/order-intent-ui');
const user={id:'77777777-7777-4777-8777-777777777777',email:'qa@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{delivery_profile:{name:'Persona ficticia',phone:'3000000000',address:'Dirección ficticia',neighborhood:'Sector ficticio',instructions:''}}};
const product={id:'33333333-3333-4333-8333-333333333333',name:'Producto ficticio',category:'Prueba',description:'Solo QA',price:1000,image:'',optionGroups:[]};
const order=id=>({public_id:id,status:'pending',created_at:'2026-10-30T10:00:00Z',subtotal:1000,delivery_fee:5000,payment_method:'CASH',customer_name:user.user_metadata.delivery_profile.name,address:'Dirección ficticia',neighborhood:'Sector ficticio',lines:[{name:product.name,quantity:1,unitPrice:1000}],delivery:null,finance:{payment_method:'CASH',payment_status:'PENDING'}});
async function main(){
 fs.mkdirSync(out,{recursive:true});const env={...process.env};for(const key of Object.keys(env))if(/SUPABASE|NEXT_PUBLIC_|AIRTABLE|SHIPDAY|RESEND|VAPID|SECRET|TOKEN|PASSWORD|API_KEY|OPENAI|META_|NODE_OPTIONS/.test(key))delete env[key];
 Object.assign(env,{NODE_ENV:'production',NEXT_DIST_DIR:'.next-logistics-check',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329'});
 const log=fs.openSync(path.join(out,'server.log'),'w'),server=spawn(process.execPath,['--require','./qa/local-only-network.cjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','-p','3178'],{cwd:root,env,stdio:['ignore',log,log],windowsHide:true});let browser;const results=[];
 try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}assert(ready);
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  for(const scenario of ['repeat','review','lost-response','lookup-unavailable']){
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});let posts=0,lookups=0,created=0,firstKey='';const records=new Map(),detailIds=[];
   await context.addInitScript(user=>{const encode=value=>btoa(JSON.stringify(value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'),token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,exp:Math.floor(Date.now()/1000)+7200,aud:'authenticated'})+'.qa';localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'qa-not-real',expires_at:Math.floor(Date.now()/1000)+7200,expires_in:7200,token_type:'bearer',user}));},user);
   await context.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin==='http://127.0.0.1:54329')return route.fulfill({json:url.pathname.endsWith('/user')?user:{}});
    if(url.origin!==base)return route.abort();
    if(url.pathname==='/api/piloto/restaurante'){
     if(request.method()==='GET'){
      if(url.searchParams.get('mode')==='menu')return route.fulfill({json:{menu:[product],name:'QA',fee:5000,enabled:true}});
      if(url.searchParams.get('mode')==='intent'){
       lookups++;if(scenario==='lookup-unavailable')return route.fulfill({status:503,json:{error:'No se pudo consultar el intento anterior. No crees otra referencia.'}});
       const id=records.get(url.searchParams.get('requestKey'));return route.fulfill({json:id?{outcome:'existing',public_id:id}:{outcome:'not_found'}});
      }
      const id=url.searchParams.get('publicId')||'PRB-000001';detailIds.push(id);return route.fulfill({json:{orders:[order(id)]}});
     }
     if(request.method()==='POST'){
      posts++;const body=request.postDataJSON();firstKey ||= body.requestKey;
      if(scenario==='lost-response'||scenario==='lookup-unavailable'){
       created++;records.set(body.requestKey,'PRB-000003');return route.abort('failed');
      }
      if(body.repeatConfirmed===true){assert.equal(body.repeatOf,'PRB-000001');assert.notEqual(body.requestKey,firstKey);created++;records.set(body.requestKey,'PRB-000002');return route.fulfill({json:{public_id:'PRB-000002',replayed:false}});}
      return route.fulfill({status:409,json:{error:'Ya tienes un pedido reciente igual. ¿Quieres revisarlo o hacer otro?',previousPublicId:'PRB-000001',canRepeat:true}});
     }
    }
    if(url.pathname.startsWith('/api/'))return route.fulfill({json:{}});
    return route.continue();
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(20000);
   async function checkout(){
    await page.goto(base+'/piloto/restaurante-mercado',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'Agregar Producto ficticio',exact:true}).click();
    const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:/^Agregar ·/}).click();
    await page.getByRole('link',{name:/^Ver pedido,/}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();
    await page.getByRole('button',{name:'Confirmar pedido de prueba',exact:true}).click();
   }
   await checkout();
   if(scenario==='repeat'||scenario==='review'){
    await page.getByText('Ya tienes un pedido reciente igual. ¿Quieres revisarlo o hacer otro?',{exact:true}).waitFor();
    const repeat=page.getByRole('button',{name:'Hacer otro pedido igual',exact:true});await repeat.waitFor();assert.equal(posts,1);
    await page.screenshot({path:path.join(out,scenario+'-390.png')});
    if(scenario==='repeat'){
     page.once('dialog',dialog=>dialog.dismiss());await repeat.click();assert.equal(posts,1);assert.equal(created,0);
     page.once('dialog',dialog=>dialog.accept());await repeat.click();
     await page.getByRole('heading',{name:'Tu pedido actual',exact:true}).waitFor();await page.waitForFunction(()=>document.body.innerText.includes('PRB-000002'));
     assert.equal(posts,2);assert.equal(created,1);assert(detailIds.includes('PRB-000002'));
    }else{
     await page.getByRole('button',{name:'Revisar pedido anterior',exact:true}).click();await page.getByRole('heading',{name:'Tu pedido actual',exact:true}).waitFor();
     await page.waitForFunction(()=>document.body.innerText.includes('PRB-000001'));assert.equal(posts,1);assert.equal(created,0);assert(detailIds.includes('PRB-000001'));
    }
   }else{
    await page.getByText(/No pudimos confirmar el resultado/).waitFor();assert.equal(posts,1);assert.equal(created,1);
    await checkout();
    if(scenario==='lost-response'){
     await page.getByText('Tu pedido ya estaba registrado. Abrimos el mismo pedido, sin crear otro.',{exact:true}).waitFor();
     assert(detailIds.includes('PRB-000003'));
    }else{
     await page.getByText(/No se pudo consultar el intento anterior/).waitFor();assert.equal(await page.getByRole('button',{name:'Hacer otro pedido igual',exact:true}).count(),0);
    }
    assert.equal(posts,1,'Recovery lookup must not resubmit a known/uncertain order');assert.equal(lookups,1);assert.equal(created,1);
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');assert.deepEqual(errors,[]);
   results.push({scenario,posts,lookups,created,passed:true,simulatedSessionAndServices:true,physicalDevice:false});await context.close();
  }
  console.log(JSON.stringify(results));
 }finally{if(browser)await browser.close();server.kill();fs.closeSync(log);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
