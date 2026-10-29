const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync,spawn}=require('node:child_process');
const {chromium}=require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const workspace=path.resolve(process.env.MERCAU_LOCAL_WORKSPACE||path.join(__dirname,'..')),root=path.resolve(process.env.MERCAU_RELEASE_ROOT||path.join(__dirname,'..')),out=path.join(workspace,'outputs/local-integration'),base='http://127.0.0.1:3073';
const cli=path.join(out,'tools/supabase.exe'),workdir=path.join(out,'stack');
async function main(){
  if(fs.existsSync(path.join(workdir,'supabase/.temp/project-ref')))throw Error('Hosted link forbidden.');
  const docker='C:/Program Files/Docker/Docker/resources/bin/docker.exe';
  const ids=execFileSync(docker,['ps','-q','--filter','name=_mercau-integration-20261028'],{encoding:'utf8'}).trim().split(/\s+/).filter(Boolean);
  if(!ids.length)throw Error('Local stack is not running.');
  const containers=JSON.parse(execFileSync(docker,['inspect',...ids],{encoding:'utf8',maxBuffer:8*1024*1024}));
  for(const container of containers)for(const bindings of Object.values(container.NetworkSettings.Ports||{}))for(const binding of bindings||[])if(binding.HostIp!=='127.0.0.1')throw Error('Non-loopback publication detected.');
  if(!containers.some(c=>Object.values(c.NetworkSettings.Ports||{}).some(bs=>(bs||[]).some(b=>b.HostIp==='127.0.0.1'&&b.HostPort==='25421'))))throw Error('Local API port not published.');
  const status=JSON.parse(execFileSync(cli,['--workdir',workdir,'status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
  const api=status.API_URL;
  if(api!=='http://127.0.0.1:25421')throw Error('Expected isolated localhost Supabase.');
  const service=status.SERVICE_ROLE_KEY,anon=status.ANON_KEY;
  if(!service||!anon)throw Error('Local keys unavailable; no hosted fallback.');
  const headers={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
  async function request(route,options={}){
    const response=await fetch(api+route,{...options,headers:{...headers,...options.headers}});
    const body=await response.json().catch(()=>null);
    if(!response.ok)throw Error('Local '+route.split('?')[0]+' failed: '+response.status+' '+String(body?.message||body?.msg||body?.error||'').slice(0,220));
    return body;
  }
  const password=crypto.randomBytes(24).toString('base64url')+'aA1!';
  const email='buyer.integration@example.invalid',name='Compradora local de prueba';
  const profile={name,phone:'+573000000000',whatsapp:'+573000000000',municipality:'Nechí',neighborhood:'Sector ficticio',address:'Calle ficticia 12, casa 3',instructions:'Dirección solo para pruebas locales.',addresses:[],notifications:{orders:true,deliveries:true,marketing:false}};
  const users=await request('/auth/v1/admin/users?page=1&per_page=50');
  let user=(users.users||[]).find(value=>value.email===email);
  if(user)await request('/auth/v1/admin/users/'+user.id,{method:'PUT',body:JSON.stringify({password,email_confirm:true})});
  else user=await request('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email,password,email_confirm:true,user_metadata:{name,birth_date:'1990-05-10',account_intent:'personal',delivery_profile:profile}})});
  // Reset only the existing fictitious local fixture so reruns start from the same state.
  await request('/rest/v1/account_profiles?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:user.id,data:profile,version:1})});
  const businessId='rec'+crypto.randomBytes(7).toString('hex');
  await request('/rest/v1/pilot_restaurants?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:'local-visual-test',name:'Restaurante local ficticio',enabled:false,directory_business_id:businessId,menu:[]})});
  const existing=await request('/rest/v1/pilot_food_orders?customer_id=eq.'+user.id+'&select=public_id');
  if(!existing.length){
    for(const [index,state]of ['accepted','rejected'].entries())await request('/rest/v1/pilot_food_orders',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({public_id:'LOCAL-VISUAL-00000'+(index+1),restaurant_id:'local-visual-test',customer_id:user.id,request_key:crypto.randomUUID(),customer_name:name,customer_phone:profile.phone,address:profile.address,neighborhood:profile.neighborhood,instructions:profile.instructions,lines:[{name:'Producto ficticio',quantity:1,unitPrice:25000}],subtotal:25000,delivery_fee:5000,status:state})});
  }
  const initialDeliveries=await request('/rest/v1/delivery_orders?select=id');assert.equal(initialDeliveries.length,0);
  const env={...process.env};for(const key of Object.keys(env))if(/SUPABASE|NEXT_PUBLIC_|SHIPDAY|AIRTABLE|RESEND|VAPID|META_|API_KEY|SECRET|PASSWORD|DATABASE_URL|POSTGRES|AWS_|OPENAI/.test(key))delete env[key];
  Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:api,NEXT_PUBLIC_SUPABASE_ANON_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service,MERCAU_BUYER_PREVIEW:'0',NEXT_DIST_DIR:'.next-integration-local',NEXT_TELEMETRY_DISABLED:'1'});
  const stdout=fs.openSync(path.join(out,'app.stdout.log'),'a'),stderr=fs.openSync(path.join(out,'app.stderr.log'),'a');
  const app=spawn(process.execPath,['--require',path.join(root,'qa/local-only-network.cjs'),'node_modules/next/dist/bin/next','dev','-p','3073','--hostname','127.0.0.1'],{cwd:root,env,stdio:['ignore',stdout,stderr],windowsHide:true});
  let browser;
  try{
    let ready=false;
    for(let i=0;i<90;i++){
      if(app.exitCode!==null)throw Error('Local app exited before readiness.');
      try{const response=await fetch(base+'/comprar/cuenta');if(response.status===200){ready=true;break;}}catch{}
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    if(!ready)throw Error('Local app not ready.');
    assert.equal((await fetch(base+'/api/mi-cuenta')).status,401);
    assert.equal((await fetch(base+'/api/mi-cuenta/pedidos')).status,401);
    browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),external=[],apiChecks=[];
    page.setDefaultNavigationTimeout(90000);
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(!['http://127.0.0.1:3073','http://127.0.0.1:25421'].includes(url.origin)){external.push(url.origin);return route.abort();}
      if(url.origin===base&&url.pathname.startsWith('/api/')&&!['/api/mi-cuenta','/api/mi-cuenta/pedidos','/api/mi-cuenta/notificaciones','/api/mi-cuenta/envios','/api/comprador/negocios','/api/negocios','/api/metrics'].includes(url.pathname))return route.abort();
      return route.continue();
    });
    page.on('response',response=>{const url=new URL(response.url());if(url.origin===base&&['/api/mi-cuenta','/api/mi-cuenta/pedidos'].includes(url.pathname))apiChecks.push({path:url.pathname,method:response.request().method(),status:response.status()});});
    await page.goto(base+'/comprar/cuenta',{waitUntil:'networkidle'});
    await page.getByRole('link',{name:'Entrar o crear mi cuenta',exact:true}).click();
    await page.getByRole('textbox',{name:'Correo electrónico',exact:true}).fill(email);
    await page.getByLabel('Contraseña',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Entrar a Mercáu',exact:true}).click();
    await page.waitForURL('**/mi-cuenta/comprador',{timeout:90000});
    await page.getByRole('heading',{name,exact:true}).waitFor();
    const profileLink=page.getByRole('link',{name:'Ver mi perfil',exact:true});assert.equal(await profileLink.getAttribute('href'),'/mi-cuenta/perfil');
    await profileLink.click();await page.waitForURL('**/mi-cuenta/perfil');
    await page.locator('[data-profile-section="personal"] summary').click();
    await page.getByRole('textbox',{name:'Nombre completo',exact:true}).fill('Compradora local editada');
    await page.locator('[data-profile-section="personal"] summary').click();
    await page.locator('[data-profile-section="addresses"] summary').click();
    const address=page.getByRole('textbox',{name:'Dirección principal (opcional)',exact:true});
    assert.equal(await address.inputValue(),profile.address);await address.fill('Calle ficticia 12, casa 4');
    await page.locator('[data-profile-section="addresses"] summary').click();
    await page.getByRole('button',{name:'Guardar mis datos',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Tus datos quedaron guardados.'}).waitFor({timeout:30000});
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelector('input')?.value==='Compradora local editada');
    await page.locator('[data-profile-section="addresses"] summary').click();assert.equal(await address.inputValue(),'Calle ficticia 12, casa 4');
    await page.screenshot({path:path.join(out,'profile-persisted-390.png'),fullPage:true});
    await page.getByRole('link',{name:'Mis pedidos',exact:true}).click();
    await page.getByRole('button',{name:'Ver detalle del pedido LOCAL-VISUAL-000001',exact:true}).waitFor();
    assert.equal(await page.locator('.buyer-order-summary').count(),2);
    await page.getByRole('button',{name:'Ver detalle del pedido LOCAL-VISUAL-000001',exact:true}).click();
    const detail=page.getByRole('dialog',{name:'Detalle del pedido',exact:true});await detail.waitFor();
    assert((await detail.innerText()).includes('30.000'));await page.screenshot({path:path.join(out,'order-detail-390.png')});
    await detail.getByRole('button',{name:'Cerrar detalle del pedido',exact:true}).click();
    await page.getByRole('link',{name:'Mi cuenta',exact:true}).last().click();await page.getByRole('heading',{name:'Compradora local editada',exact:true}).waitFor();
    await page.screenshot({path:path.join(out,'account-real-session-390.png')});
    const persisted=await request('/rest/v1/account_profiles?user_id=eq.'+user.id+'&select=data,version');
    assert.equal(persisted.length,1);assert.equal(persisted[0].data.address,'Calle ficticia 12, casa 4');assert.equal(persisted[0].data.name,'Compradora local editada');assert(persisted[0].version>=1);
    const deliveries=await request('/rest/v1/delivery_orders?select=id');assert.equal(deliveries.length,0);
    assert(apiChecks.some(x=>x.method==='PATCH'&&x.status===200));assert(apiChecks.some(x=>x.path==='/api/mi-cuenta/pedidos'&&x.status===200));assert.deepEqual(external,[]);
    const report={realLocalAuth:true,realLocalDatabase:true,mockedSession:false,physicalDeviceTest:false,viewport:390,profileLink:true,ownOrders:true,orderDetail:true,profileSaved:true,persistedAfterReload:true,databaseVersion:persisted[0].version,deliveriesCreated:0,externalRequests:0,apiChecks,productionTouched:false};
    fs.writeFileSync(path.join(out,'integration-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{
    if(browser)await browser.close();
    app.kill();fs.closeSync(stdout);fs.closeSync(stderr);
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
