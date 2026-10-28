// Local read-only review server. It is not imported by the application.
const http = require('node:http');
const { Readable } = require('node:stream');
const upstream = 'http://127.0.0.1:3041';
const port = 3043;
const uid = '11111111-1111-4111-8111-111111111111';
const bid = 'rec00000000000001';
const profile = { name:'Persona de prueba', phone:'+573000000000', whatsapp:'', municipality:'Nechí', neighborhood:'Centro', address:'', instructions:'', addresses:[], notifications:{orders:true,deliveries:true,marketing:false} };
const user = { id:uid,email:'demo@example.invalid',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01',created_at:'2026-01-01',app_metadata:{provider:'email'},user_metadata:{delivery_profile:profile} };
const business = { id:bid,name:'Negocio de demostración',category:'Comidas y bebidas',municipality:'Nechí',neighborhood:'Sector de prueba',description:'Información ficticia para revisar el diseño de Mi cuenta.',hours:'5 p. m. a 10 p. m.',whatsapp:'3000000000',status:'Publicado',photoUrl:'/demo-burger.jpg',photoKind:'photo',photoVersion:'demo',publicSlug:'negocio-de-demostracion',tags:[],secondaryCategories:[] };
const encode = value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function session() {
  const exp=Math.floor(Date.now()/1000)+3600;
  return {access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:uid,aud:'authenticated',role:'authenticated',exp,iat:exp-3600,iss:'https://mercau-account-test.supabase.co/auth/v1'})}.local-demo-only`,refresh_token:'local-demo-only',expires_at:exp,expires_in:3600,token_type:'bearer',user};
}
function json(res, body, status=200) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(body));
}
function api(path) {
  if(path==='/api/mi-cuenta')return {profile,version:0,roles:['buyer','business_owner'],businesses:[{business_id:bid,business_name:business.name,status:'Activo'}]};
  if(path==='/api/negocios')return {businesses:[business]};
  if(path==='/api/mi-cuenta/envios')return {deliveries:[]};
  if(path==='/api/mi-cuenta/pedidos')return {orders:[]};
  if(path==='/api/mi-cuenta/notificaciones')return {notifications:[]};
  if(path===`/api/mi-cuenta/negocio/${bid}`)return {business,settings:{},version:0,status:'Publicada',editable:true};
  if(path===`/api/mi-cuenta/negocio/${bid}/actividad`)return {measuredSince:null,summary:{views:0,whatsapp:0,calls:0},favorites:0,requestsCount:0,requests:[]};
  if(path===`/api/mi-negocio/${bid}`)return {business,version:'a'.repeat(64)};
  if(path===`/api/mi-negocio/${bid}/galeria`)return {photos:[],limit:8};
  if(path===`/api/mi-negocio/${bid}/catalogo`)return {business,products:[]};
  return null;
}
const worker = `self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.hostname!=='mercau-account-test.supabase.co')return;
  e.respondWith((async()=>{
    const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'};
    if(e.request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'*'}});
    if(u.pathname==='/rest/v1/favorites'&&e.request.method==='GET')return new Response('[]',{headers});
    if(u.pathname==='/auth/v1/user'&&e.request.method==='GET')return new Response(JSON.stringify(${JSON.stringify(user)}),{headers});
    if(u.pathname==='/auth/v1/logout')return new Response('{}',{headers});
    return new Response(JSON.stringify({message:'Demostración de solo lectura.'}),{status:403,headers});
  })());
});`;
function shell() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mercáu | Demostración local</title><style>
  *{box-sizing:border-box}body{margin:0;font:14px Arial,sans-serif;color:#1F2937;background:#fff;height:100dvh;display:grid;grid-template-rows:auto 1fr}header{padding:10px 16px;border-bottom:2px solid #D82016;display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#FFF1F0}header strong{color:#D82016}header a{color:#1F2937;font-weight:700}iframe{width:100%;height:100%;border:0;min-height:0}#notice{padding:20px}a:focus-visible{outline:2px solid #D82016;outline-offset:3px}
  </style></head><body><header><strong>Demostración local</strong><span>Solo lectura. Datos ficticios. No crea cuentas, pedidos ni cambios reales.</span><a href="/mi-cuenta/comprador" target="panel">Comprador</a><a href="/mi-cuenta/negocio" target="panel">Mi negocio</a><a href="/" target="_top">Reiniciar</a></header><p id="notice">Preparando la vista de prueba...</p><script>
  (async()=>{try{
    await navigator.serviceWorker.register('/__demo-worker.js',{scope:'/'});
    await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
    for(const key of ['mercau.favorites.guest.v2','mercau.favorites.user.${uid}','local-test-initialized'])localStorage.removeItem(key);
    localStorage.setItem('sb-mercau-account-test-auth-token',JSON.stringify(${JSON.stringify(session())}));
    const frame=document.createElement('iframe');frame.name='panel';frame.title='Panel Mercáu de demostración';frame.src='/mi-cuenta/comprador';document.getElementById('notice').replaceWith(frame);
  }catch{document.getElementById('notice').textContent='No se pudo preparar esta vista. Abre este enlace directamente en Chrome o Edge en el computador.';}})();
  </script></body></html>`;
}
const server = http.createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    if(req.method!=='GET'&&req.method!=='HEAD')return json(res,{error:'Esta demostración es de solo lectura. Los cambios no se guardan.'},403);
    if(path==='/') {res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(shell());}
    if(path==='/__demo-worker.js') {res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store','Service-Worker-Allowed':'/'});return res.end(worker);}
    if(path.startsWith('/api/')) {const data=api(path);return data?json(res,data):json(res,{error:'Este servicio no está disponible en la demostración.'},403);}
    if(!path.startsWith('/mi-cuenta')&&!path.startsWith('/_next/')&&!/^\/(logo-mercau\.png|demo-burger\.jpg|favicon\.ico)$/.test(path))return json(res,{error:'La demostración solo permite revisar Mi cuenta.'},404);
    const response=await fetch(upstream+req.url,{redirect:'manual'});
    const headers={'Content-Type':response.headers.get('content-type')||'application/octet-stream','Cache-Control':'no-store'};
    if(response.headers.has('location'))headers.Location=response.headers.get('location');
    res.writeHead(response.status,headers);
    if(req.method==='HEAD'||!response.body)return res.end();
    Readable.fromWeb(response.body).pipe(res);
  }catch {if(!res.headersSent)return json(res,{error:'La vista local no está disponible. Inicia primero el servidor de pruebas en el puerto 3041.'},503);res.end();}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'El puerto 3043 está ocupado.':'No se pudo iniciar la demostración local.');process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Demostración de solo lectura: http://localhost:${port}/`));
