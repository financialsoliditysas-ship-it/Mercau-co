const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript'),sharp=require('sharp');
const {NextRequest}=require('next/server');
function load(file,mocks={}){const mod=new Module(file);mod.require=id=>id in mocks?mocks[id]:require(id);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file+'.cjs');return mod.exports;}
const image=load('lib/catalog-image.ts'),urls=load('lib/catalog-image-url.ts');
const businessId='rec'+'Q'.repeat(14),productId='11111111-1111-4111-8111-111111111111',params={params:{businessId,productId}};
async function main(){
 let seed=42;const pixels=Buffer.alloc(1600*1067*3);for(let i=0;i<pixels.length;i++){seed=(seed*1664525+1013904223)>>>0;pixels[i]=seed>>>24;}
 const original=await sharp(pixels,{raw:{width:1600,height:1067,channels:3}}).jpeg({quality:85}).toBuffer();
 let row={status:'published',image_path:`${businessId}/${productId}/original.jpg`,version:1},published=true,reads=0,publicationReads=0,downloads=0;
 const route=load('app/api/negocios/[businessId]/catalogo/[productId]/foto/route.ts',{
  '@/lib/business-catalog':{catalogBucket:'business-catalog',catalogProduct:async()=>{reads++;return row;}},
  '@/lib/catalog-business-public':{catalogBusinessPublic:async()=>{publicationReads++;return published;}},
  '@/lib/catalog-validation':{validProductId:id=>id===productId},'@/lib/catalog-image':image,
  '@/lib/supabase-admin':{getSupabaseAdminClient:()=>({storage:{from:()=>({download:async()=>{downloads++;return {data:new Blob([original],{type:'image/jpeg'}),error:null};}})}})}
 });
 const request=(query='',headers={})=>new NextRequest('https://example.invalid/photo'+query,{headers:{accept:'image/webp',...headers}});
 let response=await route.GET(request('?v=1&w=320'),params);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');
 const thumb=Buffer.from(await response.arrayBuffer()),metadata=await sharp(thumb).metadata();assert.equal(metadata.width,320);assert(thumb.length<original.length*.5);
 const etag=response.headers.get('etag');assert(etag);assert.equal(response.headers.get('cache-control'),'private, max-age=0, must-revalidate');assert.equal(response.headers.get('vary'),'Accept');
 response=await route.GET(request('?v=1&w=320',{'if-none-match':etag}),params);assert.equal(response.status,304);assert.equal((await response.arrayBuffer()).byteLength,0);assert.equal(downloads,1);assert.equal(reads,2);assert.equal(publicationReads,2);
 response=await route.GET(request('?w=320',{'if-none-match':'W/'+etag}),params);assert.equal(response.status,304);
 response=await route.GET(request('?w=320'),params);assert.equal(response.status,200);assert.equal(downloads,1);
 published=false;assert.equal((await route.GET(request('?w=320',{'if-none-match':etag}),params)).status,404);published=true;
 row={...row,status:'draft'};assert.equal((await route.GET(request('?w=320',{'if-none-match':etag}),params)).status,404);
 row={...row,status:'archived'};assert.equal((await route.GET(request('?w=320'),params)).status,404);
 row={...row,status:'published',image_path:'other-business/private.jpg'};assert.equal((await route.GET(request('?w=320'),params)).status,404);
 row={...row,image_path:`${businessId}/${productId}/replacement.jpg`,version:2};response=await route.GET(request('?v=1&w=320',{'if-none-match':etag}),params);assert.equal(response.status,200);assert.notEqual(response.headers.get('etag'),etag);assert.equal(downloads,2);
 const unchanged=await route.GET(request(''),params);assert(Buffer.from(await unchanged.arrayBuffer()).equals(original));
 response=await route.GET(request('?w=640',{accept:'image/jpeg'}),params);assert.equal(response.headers.get('content-type'),'image/jpeg');assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width,640);
 const before=reads;for(const width of ['1','321','12000','-1','Infinity','bad',''])assert.equal((await route.GET(request('?w='+width),params)).status,400);assert.equal(reads,before);
 assert.equal((await route.GET(request('?w=320'),{params:{businessId:'not-a-business',productId}})).status,404);
 let loads=0;const one=()=>{loads++;return Promise.resolve({bytes:original,type:'image/jpeg'});};
 await Promise.all(Array.from({length:12},()=>image.catalogImage('same-pending-image',one,320,true)));assert.equal(loads,1);
 const actualNow=Date.now;try{Date.now=()=>actualNow()+61000;await image.catalogImage('same-pending-image',one,320,true);assert.equal(loads,2);}finally{Date.now=actualNow;}
 const bad=Buffer.from('invalid-image');assert((await image.catalogImage('corrupt-but-available',async()=>({bytes:bad,type:'image/jpeg'}),320,true)).bytes.equals(bad));
 for(let i=0;i<70;i++)await image.catalogImage('bounded-'+i,async()=>({bytes:Buffer.from('data'),type:'image/jpeg'}),null,false);
 let evictedReloaded=false;await image.catalogImage('bounded-0',async()=>{evictedReloaded=true;return {bytes:bad,type:'image/jpeg'};},null,false);assert(evictedReloaded);
 const proxy=`/api/negocios/${businessId}/catalogo/${productId}/foto?v=7`;
 assert(urls.catalogImageSources(proxy).srcSet.includes('w=320 320w'));assert.equal(urls.catalogImageSources(proxy,true).src,proxy);assert.equal(urls.catalogImageSources('https://private.invalid/photo?token=example').srcSet,undefined);
 const catalogPage=fs.readFileSync('app/negocios/[id]/catalogo/page.tsx','utf8');assert(catalogPage.includes('Promise.allSettled([loadMenuCatalog(business.id),pilotRestaurant(business.id)])'));assert(catalogPage.includes('cache(publicCatalog)'));
 assert(fs.readFileSync('lib/airtable-directory.ts','utf8').includes("typeof cache==='function'?cache(readDirectoryBusinesses):readDirectoryBusinesses"));
 console.log(JSON.stringify({passed:true,originalBytes:original.length,thumbnailBytes:thumb.length,width:metadata.width,authorizationBefore304:true,noSharedCdnCache:true,versionReplacement:true,pendingDeduplicated:true,expiryAndEviction:true,originalPreserved:true,isolatedData:true}));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
