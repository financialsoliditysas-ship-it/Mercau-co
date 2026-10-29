const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function verifyPwa(browser,base,out){
  const results=[];
  for(const mode of ['browser','standalone','ios']){
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
    page.setDefaultTimeout(90000);page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(mode=>{
      const original=window.matchMedia.bind(window);
      let currentMode=mode;const lists=[];
      window.matchMedia=query=>{const list=original(query);if(query==='(display-mode: standalone)'){Object.defineProperty(list,'matches',{get:()=>currentMode==='standalone'});lists.push(list);}return list;};
      window.__qaSetStandalone=()=>{currentMode='standalone';for(const list of [...lists])list.dispatchEvent(new Event('change'));};
      Object.defineProperty(navigator,'standalone',{configurable:true,value:mode==='ios'});
      if(mode!=='browser')new MutationObserver(()=>{
        if(location.pathname==='/'&&document.querySelector('.presentation-site')&&getComputedStyle(document.documentElement).visibility!=='hidden')sessionStorage.setItem('qa:pwa:visible-home','true');
      }).observe(document,{childList:true,subtree:true});
    },mode);
    await page.route('**/*',route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin!==base)return route.abort();
      if(url.pathname==='/__qa_pwa_seed')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><title>QA seed</title></head><body>Fixture</body></html>'});
      if(request.method()!=='GET')return route.fulfill({status:403,body:'QA: writes blocked'});
      return route.continue();
    });
    await context.addCookies([{name:'qa-session-sentinel',value:'fictitious',url:base,httpOnly:true,sameSite:'Lax'}]);
    await page.goto(base+'/__qa_pwa_seed');
    const saved={cartKey:'mercau:catalog-cart:recQQQQQQQQQQQQQQ:v1',cart:'[{"lineId":"qa","productId":"qa-product","quantity":2}]',profile:'{"name":"Persona QA","address":"Direccion ficticia"}'};
    await page.evaluate(saved=>{sessionStorage.setItem(saved.cartKey,saved.cart);localStorage.setItem('qa:saved-profile',saved.profile);},saved);
    await page.goto(base+'/?utm_source=qa_pwa').catch(error=>{if(!/ERR_ABORTED|interrupted by another navigation/.test(error.message))throw error;});
    if(mode==='browser'){
      await page.waitForURL(base+'/?utm_source=qa_pwa');await page.locator('.p-hero h1').waitFor();
      assert.notEqual(await page.locator('html').evaluate(node=>getComputedStyle(node).visibility),'hidden');
    }else{
      await page.waitForURL(base+'/comprar?utm_source=qa_pwa');await page.getByRole('heading',{name:'¿Qué quieres pedir hoy?',exact:true}).waitFor();
      assert.equal(await page.locator('.presentation-site').count(),0);
      assert.equal(await page.evaluate(()=>sessionStorage.getItem('qa:pwa:visible-home')),null,'Public Home became visible during cold launch');
    }
    const persisted=await page.evaluate(saved=>({cart:sessionStorage.getItem(saved.cartKey),profile:localStorage.getItem('qa:saved-profile')}),saved);
    assert.equal(persisted.cart,saved.cart);assert.equal(persisted.profile,saved.profile);
    assert((await context.cookies()).some(cookie=>cookie.name==='qa-session-sentinel'&&cookie.value==='fictitious'));
    if(mode==='browser'){
      await page.getByRole('button',{name:'Abrir menú',exact:true}).click();await page.getByRole('button',{name:'Cerrar menú',exact:true}).click();
      await page.evaluate(()=>window.__qaSetStandalone());await page.waitForURL(base+'/comprar?utm_source=qa_pwa');await page.getByRole('heading',{name:'¿Qué quieres pedir hoy?',exact:true}).waitFor();
    }
    await page.goto(base+'/negocios/restaurante-qa-ficticio/catalogo?utm_source=qa_deep');
    await page.getByRole('heading',{name:'Restaurante QA ficticio',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/negocios/restaurante-qa-ficticio/catalogo');
    await page.reload();await page.getByRole('heading',{name:'Restaurante QA ficticio',exact:true}).waitFor();
    if(mode!=='browser'){
      await page.locator('header a[href="/"]').first().click();await page.waitForURL(base+'/comprar');await page.getByRole('heading',{name:'¿Qué quieres pedir hoy?',exact:true}).waitFor();
      await page.goto(base+'/#cuenta');await page.waitForURL(url=>url.pathname==='/mi-cuenta');
      await page.goto(base+'/?code=qa-protected');await page.locator('.p-hero h1').waitFor();assert.equal(new URL(page.url()).searchParams.get('code'),'qa-protected');
      await page.goto(base+'/#access_token=qa-protected');await page.locator('.p-hero h1').waitFor();assert.equal(new URL(page.url()).hash,'#access_token=qa-protected');
    }
    const manifest=await (await page.request.get(base+'/manifest.webmanifest')).json();assert.equal(manifest.start_url,'/');assert.equal(manifest.id,undefined);assert.equal(manifest.scope,undefined);
    assert.deepEqual(errors,[]);
    results.push({mode,signalsEmulated:true,physicalDevice:false,rootTarget:mode==='browser'?'/':'/comprar',sentinelCookiePreserved:true,existingCartKeyBytesPreserved:true,savedDataBytesPreserved:true,deepLinkPreserved:true,deepReload:true,earlyPublicIntroHidden:mode!=='browser',spaHomeFallback:mode!=='browser',authIntentExclusions:mode!=='browser',unchangedManifest:true});
    await context.close();
  }
  fs.writeFileSync(path.join(out,'pwa-results.json'),JSON.stringify(results,null,2));console.log('PASS PWA emulated browser, standalone and iOS signals; storage sentinels, direct menu/reload, auth exceptions and manifest stability. Not physical installations.');
}
module.exports={verifyPwa};
