const assert=require('node:assert/strict');
async function verifyHome(page,base,{production=false}={}){
  await page.locator('.p-hero h1').waitFor();
  assert.match(await page.title(),/Pide comida y compra local/);
  const canonical=new URL(await page.locator('link[rel=canonical]').getAttribute('href'));assert.equal(canonical.origin,'https://www.mercau.co');assert.equal(canonical.pathname,'/');
  assert(!String(await page.locator('meta[name=robots]').getAttribute('content',{timeout:1000}).catch(()=>null)).includes('noindex'));
  for(const href of ['/comprar','/comprar/restaurantes','/comprar/comercios','/comprar/explorar','/negocios/registro','/nosotros','/nosotros#contacto','/terminos-y-condiciones','/politica-de-tratamiento-de-datos'])assert(await page.locator(`a[href="${href}"]`).count(),href);
  await page.getByRole('button',{name:'Abrir menú',exact:true}).click();
  await page.getByRole('link',{name:'Pedir ahora',exact:true}).click();await page.waitForURL(base+'/comprar');await page.getByRole('heading',{name:'¿Qué quieres pedir hoy?',exact:true}).waitFor();
  await page.goBack();await page.waitForURL(base+'/');await page.locator('.p-hero h1').waitFor();
  await page.getByRole('link',{name:/Ver qué puedo pedir/}).click();await page.waitForURL(base+'/comprar');await page.getByRole('heading',{name:'¿Qué quieres pedir hoy?',exact:true}).waitFor();
  await page.goBack();await page.waitForURL(base+'/');await page.locator('.p-hero h1').waitFor();
  await page.locator('.p-footer a[href="/nosotros#contacto"]').click();await page.waitForURL(base+'/nosotros#contacto');await page.locator('#contacto').waitFor();
  await page.getByRole('link',{name:'Explorar negocios',exact:true}).first().click();await page.waitForURL(base+'/comprar/explorar');await page.getByRole('heading',{name:'Elige un negocio',exact:true}).waitFor();
  await page.goBack();await page.waitForURL(base+'/nosotros#contacto');await page.locator('#contacto').waitFor();
  await page.goBack();await page.waitForURL(base+'/');await page.locator('.p-hero h1').waitFor();
  for(const [hash,path]of [['directorio','/comprar/explorar'],['favoritos','/comprar/favoritos'],['cuenta','/mi-cuenta'],['inscripcion','/negocios/registro']]){
    await page.goto(base+'/?utm_source=regresion_home&returnTo=https://example.invalid/#'+hash);
    await page.waitForURL(url=>url.pathname===path);
    assert.equal(new URL(page.url()).searchParams.get('utm_source'),'regresion_home');
    assert.equal(new URL(page.url()).searchParams.has('returnTo'),false);
    if(hash==='cuenta')assert.equal(new URL(page.url()).searchParams.get('entry'),'general');
  }
  await page.goto(base+'/');await page.locator('.p-hero h1').waitFor();
  await page.getByRole('button',{name:'Abrir menú',exact:true}).click();await page.getByRole('button',{name:'Cerrar menú',exact:true}).click();
  await page.evaluate(()=>{location.hash='directorio';});await page.waitForURL(base+'/comprar/explorar');await page.getByRole('heading',{name:'Elige un negocio',exact:true}).waitFor();
  await page.goBack();await page.waitForURL(base+'/');await page.locator('.p-hero h1').waitFor();
  await page.goForward();await page.waitForURL(base+'/comprar/explorar');await page.getByRole('heading',{name:'Elige un negocio',exact:true}).waitFor();
  await page.goto(base+'/#ancla-desconocida');await page.locator('.p-hero h1').waitFor();assert.equal(new URL(page.url()).hash,'#ancla-desconocida');
  for(const route of ['/listings','/listings/negocio-antiguo']){await page.goto(base+route);await page.waitForURL(base+'/comprar/explorar');await page.getByRole('heading',{name:'Elige un negocio',exact:true}).waitFor();}
  for(const route of ['/mi-cuenta','/negocios/registro','/nosotros','/terminos-y-condiciones','/politica-de-tratamiento-de-datos','/instalar'])assert.equal((await page.request.get(base+route)).status(),200,route);
  const review=await page.request.get(base+'/presentacion-revision');assert.equal(review.status(),production?404:200);
  if(production)assert.equal((await page.request.get(base+'/api/comprador/prueba-pedidos')).status(),404);
  console.log('PASS Home metadata, CTAs, legacy aliases, campaign parameters, directory history, legal/account/install routes and review guard.');
}
module.exports={verifyHome};
