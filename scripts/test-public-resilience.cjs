const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript'),vm=require('node:vm');
function load(file,mocks={}){const m=new Module(file);m.require=id=>id in mocks?mocks[id]:require(id);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file+'.cjs');return m.exports;}
class Storage{getItem(k){return this[k]||null;}setItem(k,v){this[k]=String(v);}removeItem(k){delete this[k];}}
(async()=>{
 const actualNow=Date.now,oldFetch=global.fetch,nav=Object.getOwnPropertyDescriptor(global,'navigator'),oldStore=global.sessionStorage;
 let now=100000,calls=0,release;
 try{
  Date.now=()=>now;Object.defineProperty(global,'navigator',{value:{onLine:true},configurable:true});global.sessionStorage=new Storage();
  const server=load('lib/public-read-cache.ts').publicReadCache(10000,2);
  const jobs=Array.from({length:30},()=>server('same',()=>{calls++;return new Promise(resolve=>release=()=>resolve({ok:true}));}));
  assert.equal(calls,1);release();await Promise.all(jobs);await server('same',async()=>{calls++;});assert.equal(calls,1);
  now+=10001;await server('same',async()=>{calls++;return {};});assert.equal(calls,2);
  await assert.rejects(()=>server('failed',async()=>{throw Error('network');}));await server('failed',async()=>{calls++;return {};});
  const browse=load('lib/public-browse-client.ts'),path='/api/comprar/platos?municipio=Nech%C3%AD';calls=0;
  global.fetch=async()=>{calls++;return new Response(JSON.stringify({products:[{id:'public'}],categories:[],nextCursor:null}),{headers:{'Content-Type':'application/json'}});};
  await Promise.all(Array.from({length:20},()=>browse.publicBrowse(path)));assert.equal(calls,1);
  navigator.onLine=false;assert.equal((await browse.publicBrowse(path)).stale,true);assert.equal(calls,1);
  const restored=load('lib/public-browse-client.ts');assert.equal((await restored.publicBrowse(path)).data.products[0].id,'public');
  for(const forbidden of ['/api/mi-cuenta','/api/mi-cuenta/pedidos','/api/push/comprador','/api/piloto/restaurante?mode=manager','https://evil.invalid/api/comprar/platos'])await assert.rejects(()=>browse.publicBrowse(forbidden));
  navigator.onLine=true;now+=10001;global.fetch=async()=>{throw Error('offline');};assert.equal((await browse.publicBrowse(path)).stale,true);
  global.fetch=async()=>new Response('{}',{status:403});await assert.rejects(()=>browse.publicBrowse(path,0));assert.equal(browse.recentPublicBrowse(path),null);
  global.fetch=async()=>new Response(JSON.stringify({products:[],categories:[],nextCursor:null}));await browse.publicBrowse(path,0);
  now+=15*60*1000+1;navigator.onLine=false;await assert.rejects(()=>browse.publicBrowse(path));
 }finally{Date.now=actualNow;global.fetch=oldFetch;if(nav)Object.defineProperty(global,'navigator',nav);else delete global.navigator;if(oldStore===undefined)delete global.sessionStorage;else global.sessionStorage=oldStore;}
 const origin='https://qa.invalid',entries=new Map(),listeners={},urlOf=r=>new URL(typeof r==='string'?r:r.url,origin).href;let offline=false,time=1000000,status=200,network=0;
 const cache={match:async r=>entries.get(urlOf(r))?.clone(),put:async(r,v)=>entries.set(urlOf(r),v.clone()),delete:async r=>entries.delete(urlOf(r)),keys:async()=>[...entries.keys()].map(url=>new Request(url))};
 const context={self:{location:{origin},addEventListener:(name,fn)=>listeners[name]=fn},caches:{open:async()=>cache},fetch:async request=>{network++;if(offline)throw Error('offline');const path=new URL(urlOf(request)).pathname;return new Response(path==='/offline.html'?'offline help':'public bytes',{status,headers:{'Content-Type':path.endsWith('/foto')?'image/jpeg':'text/plain'}});},Request,Response,Headers,URL,Date:{now:()=>time},Promise};
 vm.runInNewContext(fs.readFileSync('public/mercau-public-cache-v1.js','utf8'),context);
 await new Promise((resolve,reject)=>listeners.install({waitUntil:p=>p.then(resolve,reject)}));
 function dispatch(path,options={}){let response=null;const writes=[];const request={url:new URL(path,origin).href,method:options.method||'GET',headers:new Headers(options.headers),mode:options.mode||'cors'};listeners.fetch({request,respondWith:p=>response=p,waitUntil:p=>writes.push(p)});return response?response.then(async result=>{await Promise.all(writes);return result;}):null;}
 for(const path of ['/api/mi-cuenta','/api/mi-cuenta/pedidos','/api/push/comprador','/api/comprar/platos','/pagos/mercau-breb.jpeg'])assert.equal(dispatch(path),null);
 assert.equal(dispatch('/api/piloto/restaurante',{method:'POST'}),null);
 const photo='/api/negocios/rec00000000000001/catalogo/11111111-1111-4111-8111-111111111111/foto?w=320&v=1';
 assert.equal(dispatch(photo,{headers:{Authorization:'Bearer fictitious'}}),null);
 assert.equal((await dispatch(photo)).status,200);offline=true;assert.equal((await dispatch(photo)).status,200);
 assert.equal(await(await dispatch('/comprar/restaurantes',{mode:'navigate'})).text(),'offline help');
 time+=15*60000+1;await assert.rejects(()=>dispatch(photo));offline=false;status=404;assert.equal((await dispatch(photo)).status,404);offline=true;await assert.rejects(()=>dispatch(photo));
 offline=false;status=200;await dispatch('/_next/static/build/chunk.js');const before=network;offline=true;assert.equal((await dispatch('/_next/static/build/chunk.js')).status,200);assert.equal(network,before);
 offline=false;for(let i=0;i<70;i++)await dispatch(`/_next/static/build/chunk-${i}.js`);assert(entries.size<=64);assert(entries.has(origin+'/offline.html'));assert(entries.has(origin+'/logo-mercau.png'));
 const pilot=fs.readFileSync('components/RestaurantPilot.tsx','utf8');assert(pilot.indexOf('if(navigator.onLine===false)')<pilot.indexOf("if (submitInFlight.current) return;"));
 console.log('PASS: 30 simultaneous server reads use 1 load; 20 client reads use 1 GET; session/offline recovery, expiry, permission errors fail closed; bounded worker caches public assets only; no private reads or writes cached; online revocation retained; offline submit guard before intent creation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
