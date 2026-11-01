// Local-only read-only adapter. Public snapshot, no accounts, writes, messages or providers.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs/dish-discovery');
const fixture=JSON.parse(fs.readFileSync(path.join(out,'public-fixture.json')));
const publicPort=Number(process.env.DISH_REVIEW_PORT||3190),upstreamPort=publicPort+1;
function load(file,mocks={}){const m=new Module(file);m.require=id=>id in mocks?mocks[id]:require(id);m._compile(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file+'.cjs');return m.exports;}
const validation=load('lib/catalog-validation.ts'),pricing=load('lib/dish-pricing.ts',{'./catalog-validation':validation});
const rows=fixture.businesses.flatMap(b=>fixture.menus[b.id].menu.map((p,i)=>({id:p.id,business_id:b.id,name:p.name,section:p.category,price:p.price,version:1,image_path:p.image||null,option_groups:p.optionGroups,position:i,status:'published',available:true})));
const db={from(table){const filters=[],sort=[];let start=0,end=Infinity;const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},gt(k,v){filters.push(r=>r[k]>v);return q;},ilike(k,v){const term=v.slice(1,-1).replace(/\\([\\%_])/g,'$1').toLocaleLowerCase('es');filters.push(r=>r[k].toLocaleLowerCase('es').includes(term));return q;},order(k){sort.push(k);return q;},range(a,b){start=a;end=b;return q;},then(resolve,reject){let data=(table==='pilot_restaurants'?fixture.businesses.map(b=>({id:b.id,directory_business_id:b.id,enabled:true,is_live:true,directory_initialized:true})):rows).filter(r=>filters.every(f=>f(r)));data.sort((a,b)=>{for(const key of sort){const c=typeof a[key]==='number'?a[key]-b[key]:String(a[key]).localeCompare(String(b[key]));if(c)return c;}return 0;});return Promise.resolve({data:data.slice(start,end+1),count:data.length,error:null}).then(resolve,reject);}};return q;}};
const discover=load('lib/dish-discovery.ts',{'./business-order-hours':load('lib/business-order-hours.ts'),'./public-read-cache':load('lib/public-read-cache.ts'),'./airtable-directory':{loadDirectoryBusinesses:async()=>fixture.businesses},'./supabase-admin':{getSupabaseAdminClient:()=>db},'./catalog-validation':validation,'./dish-pricing':pricing,'./business-public-url':{businessCatalogPath:b=>`/negocios/${b.publicSlug||b.id}/catalogo`,businessPath:b=>`/negocios/${b.publicSlug||b.id}`}});
const env={...process.env};for(const key of Object.keys(env))if(/SUPABASE|NEXT_PUBLIC_|AIRTABLE|SHIPDAY|RESEND|VAPID|SECRET|TOKEN|PASSWORD|API_KEY|OPENAI|META_|NODE_OPTIONS/.test(key))delete env[key];
Object.assign(env,{NODE_ENV:'production',NEXT_DIST_DIR:'.next-logistics-check',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',NEXT_PUBLIC_SUPABASE_ANON_KEY:'qa-not-a-real-key'});
const log=fs.openSync(path.join(out,'review-server.log'),'w');
const child=spawn(process.execPath,['--require','./qa/local-only-network.cjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','-p',String(upstreamPort)],{cwd:root,env,stdio:['ignore',log,log],windowsHide:true});
function json(response,status,data){response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify(data));}
const server=http.createServer(async(request,response)=>{
 try{
  const url=new URL(request.url,'http://127.0.0.1');
  if(url.pathname==='/api/metricas'&&request.method==='POST'){request.resume();return json(response,200,{ok:true,localOnly:true});}
  if(request.method!=='GET'&&request.method!=='HEAD'){request.resume();return json(response,403,{error:'Prueba local: pedidos, cobros y mensajes bloqueados.'});}
  const image=fixture.images[url.pathname];if(image){response.writeHead(200,{'Content-Type':image.type});return response.end(Buffer.from(image.base64,'base64'));}
  if(url.pathname==='/api/comprador/negocios'||url.pathname==='/api/negocios')return json(response,200,{businesses:fixture.businesses});
  if(url.pathname==='/api/comprar/platos')return json(response,200,await discover.discoverDishes({municipality:url.searchParams.get('municipio'),query:url.searchParams.get('q')||'',section:url.searchParams.get('categoria')||'',cursor:url.searchParams.get('cursor')||''}));
  if(url.pathname==='/api/piloto/restaurante'&&url.searchParams.get('mode')==='menu')return json(response,200,fixture.menus[url.searchParams.get('restaurant')]||{menu:[],enabled:false,fee:0});
  if(url.pathname==='/api/piloto/restaurante'&&url.searchParams.get('mode')==='availability')return json(response,200,{enabled:Boolean(fixture.menus[url.searchParams.get('restaurant')]),availabilityMessage:''});
  if(url.pathname.startsWith('/api/'))return json(response,401,{error:'Sin sesión operativa en esta prueba local.'});
  if(!url.pathname.startsWith('/comprar')&&!url.pathname.startsWith('/_next/')&&!['/mercau-sw.js','/mercau-public-cache-v1.js','/offline.html'].includes(url.pathname)&&!/\.(?:png|jpg|jpeg|webp|woff2?|svg|ico)$/.test(url.pathname))return json(response,403,{error:'Solo experiencia de descubrimiento local. Las rutas operativas están bloqueadas.'});
  const upstream=await fetch(`http://127.0.0.1:${upstreamPort}${request.url}`,{headers:{...(request.headers.rsc?{rsc:request.headers.rsc}:{})}});
  let bytes=Buffer.from(await upstream.arrayBuffer());const type=upstream.headers.get('content-type')||'application/octet-stream';
  if(type.includes('text/html'))bytes=Buffer.from(bytes.toString().replace('</head>','<style>body:before{content:"PRUEBA LOCAL · Oferta pública capturada · Sin pedidos ni mensajes";display:block;background:#fff5df;color:#604c12;text-align:center;font:11px Arial;padding:5px}</style></head>'));
  response.writeHead(upstream.status,{'Content-Type':type,'Cache-Control':'no-store'});response.end(bytes);
 }catch(error){json(response,503,{error:'No se pudo cargar la prueba local.'});}
});
server.listen(publicPort,'127.0.0.1',()=>console.log(`Local isolated review: http://127.0.0.1:${publicPort}/comprar/restaurantes`));
function stop(){server.close();child.kill();fs.closeSync(log);process.exit();}process.on('SIGINT',stop);process.on('SIGTERM',stop);child.on('exit',code=>{if(code){console.error('Local app exited',code);stop();}});
