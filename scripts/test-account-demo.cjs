const assert=require('node:assert/strict');
const { chromium }=require('C:/Users/isver/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    for(const width of [390,1440]){
      const page=await browser.newPage({viewport:{width,height:950}});
      const errors=[],hosts=new Set();page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>hosts.add(new URL(request.url()).hostname));
      await page.goto('http://localhost:3043/');
      const panel=page.frameLocator('iframe[name=panel]');
      await panel.getByRole('heading',{name:'Hola, Persona',exact:true}).waitFor({timeout:60000});
      assert.equal(await panel.getByRole('button',{name:'Entrar a Mercáu',exact:true}).count(),0);
      await page.getByRole('link',{name:'Mi negocio',exact:true}).click();
      await panel.getByRole('heading',{name:'Negocio de demostración',exact:true}).waitFor();
      await page.screenshot({path:`account-demo-open-${width}.png`,fullPage:true});
      const readonly=await page.request.post('http://localhost:3043/api/mi-cuenta',{data:{profile:{name:'No guardar'}}});assert.equal(readonly.status(),403);
      const delivery=await page.request.post('http://localhost:3043/api/deliveries',{data:{}});assert.equal(delivery.status(),403);
      assert(![...hosts].some(host=>!['localhost','mercau-account-test.supabase.co'].includes(host)),[...hosts].join(','));
      assert.deepEqual(errors,[]);
      await page.close();
    }
    console.log('PASS demo URL: buyer and business open without credentials at 390/1440, fake data only, mutations/deliveries rejected, no application errors. No production calls.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
