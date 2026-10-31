const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
function load(file,mocks={}){const m=new Module(file);m.require=id=>id in mocks?mocks[id]:require(id);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file+'.cjs');return m.exports;}
const validation=load('lib/catalog-validation.ts');
const pricing=load('lib/dish-pricing.ts',{'./catalog-validation':validation});
const id=i=>'rec'+String(i).padStart(14,'0');
const directory=Array.from({length:15},(_,i)=>({id:id(i),name:`Restaurante ${i}`,municipality:'Nechí',category:'Comidas y bebidas'}));
directory.push({id:id(90),name:'Oculto',municipality:'Nechí',category:'Comidas y bebidas',pilotRestaurant:'restaurante-mercado'},
 {id:id(91),name:'Pausado',municipality:'Nechí',category:'Comidas y bebidas'},
 {id:id(92),name:'Tienda',municipality:'Nechí',category:'Tiendas y comercio'},
 {id:id(93),name:'Otro municipio',municipality:'Caucasia',category:'Comidas y bebidas'});
const restaurants=directory.map(b=>({id:b.id,directory_business_id:b.id,enabled:b.name!=='Pausado',is_live:true,directory_initialized:true}));
const rows=directory.flatMap(b=>Array.from({length:b.id===id(0)?4:2},(_,i)=>({id:`${b.id}-${i}`,business_id:b.id,name:i?'Sopa':'Pollo',section:i?'Sopas':'Asados',price:10000+i*1000,status:'published',available:true,position:i,version:1,image_path:'private/path',option_groups:[]})));
rows.push({...rows[0],id:'draft',status:'draft'}, {...rows[0],id:'unavailable',available:false}, {...rows[0],id:'zero',price:0});
let failed=false,calls=[];
const db={from(table){const filters=[],sort=[];let start=0,end=Infinity,columns='';const q={select(value){columns=value;return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},gt(k,v){filters.push(r=>r[k]>v);return q;},or(){return q;},ilike(k,v){const word=v.slice(1,-1).replace(/\\([\\%_])/g,'$1').toLowerCase();filters.push(r=>r[k].toLowerCase().includes(word));return q;},order(k){sort.push(k);return q;},range(a,b){start=a;end=b;return q;},then(resolve,reject){calls.push({table,columns,start,end});let data=(table==='pilot_restaurants'?restaurants:rows).filter(r=>filters.every(f=>f(r)));data.sort((a,b)=>{for(const key of sort){const c=typeof a[key]==='number'?a[key]-b[key]:String(a[key]).localeCompare(String(b[key]));if(c)return c;}return 0;});return Promise.resolve({error:failed?{}:null,count:data.length,data:data.slice(start,end+1)}).then(resolve,reject);}};return q;}};
const discover=load('lib/dish-discovery.ts',{'./airtable-directory':{loadDirectoryBusinesses:async()=>directory},'./supabase-admin':{getSupabaseAdminClient:()=>db},'./catalog-validation':validation,'./dish-pricing':pricing,'./business-public-url':{businessCatalogPath:b=>`/negocios/${b.id}/catalogo`,businessPath:b=>`/negocios/${b.id}`}});
function storage(entries){const map=new Map(entries);return{get length(){return map.size;},key:i=>[...map.keys()][i]||null,getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
(async()=>{
 let result=await discover.discoverDishes({municipality:'Nechí'});assert.equal(result.products.length,12);assert.equal(new Set(result.products.map(p=>p.restaurantId)).size,12);
 assert.deepEqual(result.categories,['Asados','Sopas']);assert(result.nextCursor);assert(!JSON.stringify(result).includes('private/path'));assert(!JSON.stringify(result).includes('option_groups'));
 const all=[...result.products];while(result.nextCursor){result=await discover.discoverDishes({municipality:'Nechí',cursor:result.nextCursor});all.push(...result.products);}
 assert.equal(all.length,32);assert.equal(new Set(all.map(p=>p.id)).size,32);assert(!all.some(p=>[90,91,92,93].map(id).includes(p.restaurantId)));
 assert(calls.filter(c=>c.table==='business_catalog_products'&&c.columns!=='section').every(c=>c.end===c.start),'Read one product per restaurant, not full menus');
 const again=await discover.discoverDishes({municipality:'Nechí'});assert.deepEqual(again.products,all.slice(0,12));
 assert((await discover.discoverDishes({municipality:'Nechí',query:'Restaurante 1'})).products.some(p=>p.restaurantId===id(1)));
 assert((await discover.discoverDishes({municipality:'Nechí',query:'Sopa',section:'Sopas'})).products.every(p=>p.name==='Sopa'));
 assert.equal((await discover.discoverDishes({municipality:'Nechí',query:'inexistente'})).products.length,0);
 calls=[];assert.equal((await discover.discoverDishes({municipality:'Caucasia'})).products.length,0);assert.equal(calls.length,0);
 await assert.rejects(()=>discover.discoverDishes({municipality:'Nechí',query:'changed',cursor:again.nextCursor}));
 failed=true;await assert.rejects(()=>discover.discoverDishes({municipality:'Nechí'}));failed=false;
 const group={id:'11111111-1111-4111-8111-111111111111',name:'Tamaño',type:'single',required:true,minSelections:1,maxSelections:1,choices:[{id:'22222222-2222-4222-8222-222222222222',name:'Mediano',priceDelta:2000,defaultSelected:false},{id:'33333333-3333-4333-8333-333333333333',name:'Grande',priceDelta:4000,defaultSelected:false}]};
 assert.deepEqual(pricing.dishStartingPrice(10000,[group]),{price:12000,from:true});assert.deepEqual(pricing.dishStartingPrice(10000,[]),{price:10000,from:false});
 const carts=load('lib/dish-cart.ts'),store=storage([[`mercau:catalog-cart:${id(0)}:v1`,'[{"quantity":1}]'],[`mercau:catalog-cart:${id(1)}:v1`,'[]'],['other','unchanged']]);
 assert.deepEqual(carts.savedDishCarts(store),[id(0)]);assert.equal(carts.uncertainDishOrder(store,id(0)),false);store.setItem(`mercau:order-intent:user:${id(0)}`,'receipt');assert(carts.uncertainDishOrder(store,id(0)));assert.equal(store.getItem('other'),'unchanged');
 console.log('PASS dish eligibility, private field projection, balanced stable pagination, search, sections, empty/error, minimum variants, existing cart/uncertain intent. Isolated fixtures only.');
})().catch(error=>{console.error(error);process.exitCode=1;});
