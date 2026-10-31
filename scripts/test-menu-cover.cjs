const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript'),sharp=require('sharp');
function load(file,mocks={}){const m=new Module(file);m.require=id=>id in mocks?mocks[id]:id.startsWith('@/components/')?{default:()=>null}:require(id);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file+'.cjs');return m.exports;}
const cover=load('lib/menu-cover.ts');
const business={id:'rec00000000000001',name:'Restaurante de prueba aislada',category:'Comidas y bebidas',photoUrl:'/logo.jpg',photoKind:'logo',photoVersion:'1'};
const productId='11111111-1111-4111-8111-111111111111',imageUrl=`/api/negocios/${business.id}/catalogo/${productId}/foto?v=2`;
let products=[{imageUrl:undefined},{imageUrl},{imageUrl:'/second.jpg'}],published=business,failPhoto=false,calls=0;
const shared={
 '@/lib/public-business':{loadPublicBusiness:async()=>published},
 '@/lib/business-catalog':{publicCatalog:async()=>({products})},
 '@/lib/catalog-validation':{isFoodBusiness:category=>category==='Comidas y bebidas',catalogNoun:()=> 'Menú'},
 '@/lib/menu-cover':cover,
};
(async()=>{
 const selected=cover.menuCover(business,products);assert.equal(selected.imageUrl,imageUrl);assert.deepEqual(cover.menuCover(business,products),selected);
 const tied=[{id:'b',position:0,imageUrl:'/b'},{id:'a',position:0,imageUrl:'/a'}];assert.deepEqual(cover.menuCover(business,tied),cover.menuCover(business,[...tied].reverse()));assert.equal(cover.menuCover(business,tied).imageUrl,'/a');
 assert.notEqual(cover.menuCover(business,[{imageUrl:imageUrl.replace('v=2','v=3')}]).version,selected.version);
 assert.equal(cover.menuCover(business,[]).imageUrl,'');assert.equal(cover.menuCover({...business,photoKind:'photo'},[]).imageUrl,business.photoUrl);
 const page=load('app/negocios/[id]/catalogo/page.tsx',{...shared,'next/link':{default:()=>null},'next/navigation':{},'@/lib/restaurant-pilot':{},'@/lib/business-public-url':{businessSiteUrl:'https://www.mercau.co',businessCatalogPath:b=>`/negocios/${b.id}/catalogo`,businessPath:b=>`/negocios/${b.id}`}});
 const metadata=await page.generateMetadata({params:{id:business.id}});assert(metadata.openGraph.images[0].url.endsWith(`/catalogo/og?v=${selected.version}`));assert.equal(metadata.twitter.images[0],metadata.openGraph.images[0].url);
 const original=await sharp({create:{width:600,height:400,channels:3,background:'#d82016'}}).jpeg().toBuffer();
 const route=load('app/api/negocios/[businessId]/catalogo/og/route.ts',{...shared,sharp:{default:sharp},'../[productId]/foto/route':{GET:async(request,{params})=>{calls++;assert.equal(params.businessId,business.id);assert.equal(params.productId,productId);assert.equal(request.nextUrl.searchParams.get('w'),'960');return new Response(original,{status:failPhoto?404:200});}},'../../og/route':{GET:async()=>new Response('business-fallback',{headers:{'content-type':'image/jpeg'}})}});
 const request=new Request(`https://www.mercau.co/api/negocios/${business.id}/catalogo/og`),params={params:{businessId:business.id}};
 const response=await route.GET(request,params);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');const size=await sharp(Buffer.from(await response.arrayBuffer())).metadata();assert.equal(size.width,1200);assert.equal(size.height,630);assert.equal(calls,1);
 failPhoto=true;assert.equal(await(await route.GET(request,params)).text(),'business-fallback');
 products=[];assert.equal(await(await route.GET(request,params)).text(),'business-fallback');
 products=[{imageUrl:'https://other.invalid/photo.jpg'}];assert.equal(await(await route.GET(request,params)).text(),'business-fallback');assert.equal(calls,2);
 published=null;assert.equal((await route.GET(request,params)).status,404);
 console.log('PASS stable shared menu cover, versioned metadata, real 1200x630 JPEG, private/unavailable image fallback, no remote image injection. Isolated fixtures only.');
})().catch(error=>{console.error(error);process.exitCode=1;});
