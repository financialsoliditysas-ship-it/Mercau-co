const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),ts=require('typescript');
function load(file,mocks={}){const mod=new Module(file);mod.require=id=>id in mocks?mocks[id]:require(id);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file+'.cjs');return mod.exports;}
(async()=>{
 const validation=load('lib/catalog-validation.ts'),commercial=load('lib/buyer-commercial.ts',{'./catalog-validation':validation});
 const rows=[{id:'plain',hasCatalog:false,photoUrl:''},{id:'logo',hasCatalog:false,photoUrl:'/logo.jpg'},{id:'menu-no-photo',hasCatalog:true,photoUrl:''},{id:'menu-photo',hasCatalog:true,photoUrl:'/photo.jpg'},{id:'same-rank',hasCatalog:true,photoUrl:'/other.jpg'}];
 assert.deepEqual([...rows].sort(commercial.compareDirectoryPresentation).map(row=>row.id),['menu-photo','same-rank','menu-no-photo','logo','plain']);assert.equal(rows[0].id,'plain');
 const originalFetch=global.fetch,originalNow=Date.now;let calls=0,release;let now=1000;
 try{
  Date.now=()=>now;global.fetch=()=>{calls++;return new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({businesses:rows,preview:false})});});};
  const browsing=load('lib/public-browse-client.ts');
  const client=load('lib/buyer-directory-client.ts',{'./public-browse-client':browsing});assert.equal(client.recentBuyerDirectory(),null);
  const one=client.refreshBuyerDirectory(),two=client.refreshBuyerDirectory();assert.strictEqual(one,two);assert.equal(calls,1);release();await one;
  assert.equal(client.recentBuyerDirectory().businesses.length,5);now+=30001;assert.equal(client.recentBuyerDirectory().stale,true);
  global.fetch=async()=>{throw Error('offline');};assert.equal((await client.refreshBuyerDirectory()).stale,true);
  now+=15*60*1000+1;assert.equal(client.recentBuyerDirectory(),null);await assert.rejects(()=>client.refreshBuyerDirectory());
 }finally{global.fetch=originalFetch;Date.now=originalNow;}
 const code=fs.readFileSync('app/api/negocios/route.ts','utf8');assert(code.includes('Promise.all'));assert(code.includes('catalogBusinessAvailability(directory.map'));
 assert(fs.readFileSync('app/piloto/restaurante-mercado/page.tsx','utf8').includes('<RestaurantPilot visualMenu />'));
 assert(!fs.readFileSync('app/piloto/restaurante/page.tsx','utf8').includes('visualMenu'));
 console.log('PASS public-directory ranking/cache expiry/deduplication, parallel reads and demo-only menu presentation. No writes or order changes.');
})().catch(error=>{console.error(error);process.exitCode=1;});
