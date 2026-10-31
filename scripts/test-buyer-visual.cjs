const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
function load(file,mocks={}) {
  const mod=new Module(file);mod.require=id=>id in mocks?mocks[id]:require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file+'.cjs');
  return mod.exports;
}
const validation=load('lib/catalog-validation.ts');
const commercial=load('lib/buyer-commercial.ts',{'./catalog-validation':validation});
const fixtures=load('data/buyer-preview.ts').buyerPreviewBusinesses;
assert.equal(commercial.commercialLabel(fixtures[0]),'Ver menú');
assert.equal(commercial.commercialLabel(fixtures[2]),'Ver catálogo');
assert.equal(commercial.commercialLabel(fixtures[3]),'Ver servicios');
assert.equal(commercial.commercialLabel(fixtures[7]),null);
assert.equal(commercial.commercialLabel({...fixtures[3],hasCatalog:false}),null);
assert.equal(commercial.commercialLabel({...fixtures[3],commercialKind:undefined}),'Ver catálogo');
for(const [key,name] of Object.entries(commercial.quickCategoryNames))assert(fixtures.some(b=>commercial.matchesQuickCategory(b,key)),`Missing ${name} fixture`);
const route=load('app/api/comprador/negocios/route.ts',{
  '@/lib/public-read-cache':load('lib/public-read-cache.ts'),
  '@/app/api/negocios/route':{GET:async()=>new Response(JSON.stringify({businesses:[],realDirectory:true}))},
  '@/data/buyer-preview':{buyerPreviewBusinesses:fixtures},
});
(async()=>{
  const env=process.env.NODE_ENV,flag=process.env.MERCAU_BUYER_PREVIEW;
  try{
    process.env.NODE_ENV='production';process.env.MERCAU_BUYER_PREVIEW='1';
    const data=await(await route.GET()).json();assert.equal(data.preview,undefined);assert.equal(data.realDirectory,true);
    process.env.NODE_ENV='development';assert.equal((await(await route.GET()).json()).preview,true);
  }finally{
    if(env===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=env;
    if(flag===undefined)delete process.env.MERCAU_BUYER_PREVIEW;else process.env.MERCAU_BUYER_PREVIEW=flag;
  }
  console.log('PASS commercial variants, explicit services, quick filters, preview excluded from production. Mocked data only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
