const assert=require('node:assert/strict');
const fs=require('node:fs');const Module=require('node:module');const ts=require('typescript');
const {NextRequest}=require('next/server');
function load(path,mocks={}) {
  const mod=new Module(path);mod.require=id=>id in mocks?mocks[id]:require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,path+'.cjs');return mod.exports;
}
const validation=load('lib/catalog-validation.ts'),photo=load('lib/business-photo.ts');
const businessId='recXRpTxUmzbiZYLO',other='recGLMhJYXTRE46st';
const id='11111111-1111-4111-8111-111111111111';
const optionGroup={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Tamaño',type:'single',required:true,minSelections:1,maxSelections:1,choices:[
  {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Normal',priceDelta:0,defaultSelected:true},
  {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',name:'Grande',priceDelta:3000,defaultSelected:false}
]};
const fields={name:'Producto de prueba',description:'Prueba local',section:'Bebidas',price:15000,available:true,status:'draft',position:0,optionGroups:[optionGroup]};
assert.deepEqual(validation.catalogFields(fields),fields);
for(const bad of [{...fields,name:''},{...fields,price:1.5},{...fields,price:-1},{...fields,price:'15000'},{...fields,business_id:other},{...fields,image_path:'evil'},{...fields,status:'evil'},{...fields,available:'true'},{...fields,optionGroups:[{...optionGroup,maxSelections:2}]},{...fields,optionGroups:[{...optionGroup,choices:[{...optionGroup.choices[0],priceDelta:-1}]}]}])assert.throws(()=>validation.catalogFields(bad));
const rows=[],files=new Map();let member=true,writes=0,failUpload=false;
const db={from(table){if(table==='business_catalog_product_option_groups'){const empty={select:()=>empty,eq:()=>empty,then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)};return empty;}assert.equal(table,'business_catalog_products');let filters=[],action='',payload;
  const execute=()=>{
    if(action==='insert') {
      if(rows.some(row=>row.id===payload.id))return {data:null,error:{code:'23505'}};
      rows.push({...payload,version:1,image_path:null,updated_at:'2026-10-13'});writes++;
      return {data:rows.at(-1),error:null};
    }
    let data=rows.filter(row=>filters.every(([key,value])=>row[key]===value));
    if(action==='update') {data=data.map(row=>{Object.assign(row,payload,{version:row.version+1});writes++;return row;});}
    return {data,error:null};
  };
  const q={select:()=>q,eq:(key,value)=>{filters.push([key,value]);return q;},order:()=>q,
    insert:value=>{action='insert';payload=value;return q;},update:value=>{action='update';payload=value;return q;},
    range:async(start,end)=>{const result=execute();return {...result,data:result.data.slice(start,end+1)};},
    maybeSingle:async()=>{const result=execute();return {...result,data:Array.isArray(result.data)?result.data[0] || null:result.data};},
    single:async()=>{const result=execute();return {...result,data:Array.isArray(result.data)?result.data[0]:result.data};}};return q;
},storage:{from(bucket){assert.equal(bucket,'business-catalog');return {
  createSignedUrl:async path=>({data:{signedUrl:'https://example.invalid/'+path},error:null}),
  createSignedUrls:async paths=>({data:paths.map(path=>({path,signedUrl:'https://example.invalid/'+path})),error:null}),
  upload:async(path,bytes)=>{if(failUpload)return {error:{}};files.set(path,bytes);return {error:null};},
  download:async path=>({data:files.has(path)?new Blob([files.get(path)],{type:'image/jpeg'}):null,error:files.has(path)?null:{}})
};}}};
const directory={loadDirectoryBusiness:async id=>id===businessId?{id:businessId,name:'Ficha de prueba'}:null};
const catalog=load('lib/business-catalog.ts',{
  '@/app/api/mi-negocio/[businessId]/route':{GET:async request=>!request.headers.get('authorization')?Response.json({error:'Login'},{status:401}):!member?Response.json({error:'No access'},{status:403}):Response.json({business:{id:businessId}})},
  './supabase-admin':{getSupabaseAdminClient:()=>db},'./airtable-directory':directory,'./catalog-validation':validation
});
const http=load('lib/catalog-http.ts',{'./business-catalog':catalog});
const mocks={'@/lib/catalog-business-public':{catalogBusinessPublic:async id=>id===businessId},'@/lib/business-catalog':catalog,'@/lib/catalog-http':http,'@/lib/catalog-validation':validation,'@/lib/business-photo':photo,'@/lib/supabase-admin':{getSupabaseAdminClient:()=>db},'@/lib/airtable-directory':directory};
const collection=load('app/api/mi-negocio/[businessId]/catalogo/route.ts',mocks);
const item=load('app/api/mi-negocio/[businessId]/catalogo/[productId]/route.ts',mocks);
const upload=load('app/api/mi-negocio/[businessId]/catalogo/[productId]/foto/route.ts',mocks);
mocks['@/lib/catalog-image']=load('lib/catalog-image.ts');
const publicPhoto=load('app/api/negocios/[businessId]/catalogo/[productId]/foto/route.ts',mocks);
const context={params:{businessId,productId:id}};
const req=(method,body,auth=true)=>new NextRequest('https://example.invalid/catalogo',{method,headers:{...(auth?{Authorization:'Bearer test-only'}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
(async()=>{
  assert.equal((await collection.POST(req('POST',{id,fields},false),context)).status,401);
  member=false;assert.equal((await collection.POST(req('POST',{id,fields}),context)).status,403);member=true;assert.equal(writes,0);
  assert.equal((await collection.POST(req('POST',{id,fields:{...fields,business_id:other}}),context)).status,400);
  assert.equal((await collection.POST(req('POST',{id,fields}),context)).status,201);
  assert.equal((await collection.POST(req('POST',{id,fields}),context)).status,201);assert.equal(rows.length,1);
  assert.equal((await catalog.publicCatalog(businessId)).products.length,0);
  assert.equal(await catalog.publicCatalog(other),null);
  const publish={...fields,status:'published'};
  assert.equal((await item.PATCH(req('PATCH',{version:1,fields:publish}),context)).status,200);
  assert.equal(rows[0].version,2);
  assert.equal((await item.PATCH(req('PATCH',{version:1,fields:{...publish,price:17000}}),context)).status,409);
  assert.equal((await item.PATCH(req('PATCH',{version:1,fields:publish}),context)).status,200);assert.equal(rows[0].version,2);
  const body={version:2,requestId:'22222222-2222-4222-8222-222222222222',file:Buffer.from([255,216,255,224,0,0]).toString('base64')};
  failUpload=true;assert.equal((await upload.POST(req('POST',body),context)).status,503);assert.equal(rows[0].image_path,null);failUpload=false;
  assert.equal((await upload.POST(req('POST',body),context)).status,200);assert.equal(rows[0].version,3);
  assert.equal((await upload.POST(req('POST',body),context)).status,200);assert.equal(files.size,1);assert.equal(rows[0].version,3);
  assert.equal((await publicPhoto.GET(req('GET'),context)).status,200);
  const publicData=(await catalog.publicCatalog(businessId)).products[0];assert(!('image_path' in publicData));assert(!('version' in publicData));assert(publicData.imageUrl.startsWith('/api/negocios/'));
  assert.equal((await publicPhoto.GET(req('GET'),{params:{businessId:other,productId:id}})).status,404);
  assert.equal((await item.PATCH(req('PATCH',{version:3,fields:{...publish,status:'archived'}}),context)).status,200);
  assert.equal((await catalog.publicCatalog(businessId)).products.length,0);
  assert.equal((await publicPhoto.GET(req('GET'),context)).status,404);assert.equal(rows.length,1);assert.equal(files.size,1);
  assert.equal((await catalog.ownerProducts(businessId)).length,1);
  console.log('PASS catalog validation, owner access, protected fields, create/retry, draft privacy, publish, version conflict, upload/failure/retry, photo isolation, archive and preserved records. All data simulated.');
})().catch(error=>{console.error(error);process.exitCode=1;});
