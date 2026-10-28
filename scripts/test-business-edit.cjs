const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
function load(path, mocks = {}) {
  const mod = new Module(path);
  mod.require = id => id in mocks ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,path+'.cjs');
  return mod.exports;
}
const edit = load('lib/business-edit.ts',{'@/data/directory':load('data/directory.ts')});
const original = {id:'recXRpTxUmzbiZYLO',name:'Ficha de prueba',whatsapp:'+573001234567',description:'Descripción anterior',neighborhood:'Dirección anterior',hours:'17 a 22',deliveries:'No',instagram:'https://instagram.com/prueba',facebook:'',mapsUrl:''};
const changes = {...edit.businessEditValues(original),description:'Descripción nueva',hours:'',instagram:''};
assert.deepEqual(edit.validateBusinessEdit(changes),changes);
for (const value of [{...changes,user_id:'another-user'},{...changes,status:'Verificado'},{...changes,description:''},{...changes,deliveries:'inventado'},{...changes,mapsUrl:'javascript:alert(1)'},{...changes,description:'a'.repeat(701)}]) assert.throws(()=>edit.validateBusinessEdit(value));
const classified=edit.validateBusinessEdit({...changes,category:'Comidas y bebidas',subcategory:'Restaurantes',secondaryCategories:['Tiendas y comercio'],tags:['Domicilios']});assert.equal(classified.subcategory,'Restaurantes');assert.throws(()=>edit.validateBusinessEdit({...classified,subcategory:'Abogados'}));
let member=true, valid=true, current={...original}, posts=0, failWrite=false;
const rows=[];
const filters=[];
const db={auth:{getUser:async()=>({data:{user:valid ? {id:'user-a',email_confirmed_at:'confirmed'} : null}})},from(){const chain={select:()=>chain,eq:(k,v)=>{filters.push([k,v]);return chain;},maybeSingle:async()=>({data:member ? {private_token:'test-private-token'} : null})};return chain;}};
const {NextRequest}=require('next/server');
const route=load('app/api/mi-negocio/[businessId]/route.ts',{
  '@/lib/supabase-admin':{getSupabaseAdminClient:()=>db},
  '@/lib/airtable-directory':{loadDirectoryBusiness:async()=>current},
  '@/lib/business-edit':edit,
  '@/app/api/actualizaciones/[token]/route':{GET:async()=>Response.json({business:{id:original.id}})}
});
const req=(body,authorization=true)=>new NextRequest('https://example.invalid/api/mi-negocio/'+original.id,{method:body ? 'PATCH' : 'GET',headers:authorization ? {Authorization:'Bearer test-only','Content-Type':'application/json'} : {},...(body ? {body:JSON.stringify(body)} : {})});
const context={params:{businessId:original.id}};
const oldFetch=global.fetch;
process.env.AIRTABLE_API_KEY='test-only';process.env.AIRTABLE_BASE_ID='appTestOnly0000000';
global.fetch=async(_url,options)=>{
  if(options.method==='POST') {
    posts++;
    if(failWrite)return Response.json({}, {status:500});
    const fields=JSON.parse(options.body).records[0].fields;
    rows.push({id:'test-record',fields,createdTime:new Date().toISOString()});
    current={...current,...JSON.parse(fields.fld5XhR6GjiKu6fF3).after};
    return Response.json({records:[rows.at(-1)]});
  }
  return Response.json({records:rows});
};
(async()=>{
  try {
    assert.equal((await route.GET(req(null,false),context)).status,401);
    valid=false;assert.equal((await route.GET(req(null),context)).status,401);valid=true;
    member=false;assert.equal((await route.PATCH(req({}),context)).status,403);member=true;
    assert(filters.some(([k,v])=>k==='user_id'&&v==='user-a'));
    const data=await(await route.GET(req(null),context)).json();
    const body={changes,version:data.version,requestId:'11111111-1111-4111-8111-111111111111'};
    assert.equal((await route.PATCH(req({...body,changes:{...changes,whatsapp:'evil'}}),context)).status,400);
    assert.equal(posts,0);
    assert.equal((await route.PATCH(req(body),context)).status,200);
    assert.equal(rows[0].fields.fldxcaBA32ryuBUya,'Aplicada');
    const note=JSON.parse(rows[0].fields.fld5XhR6GjiKu6fF3);
    assert.equal(note.actor_id,'user-a');assert.equal(note.before.description,original.description);assert.equal(note.after.description,changes.description);
    assert.equal((await route.PATCH(req(body),context)).status,200);assert.equal(posts,1);
    rows.length=0;
    assert.equal((await route.PATCH(req({...body,requestId:'22222222-2222-4222-8222-222222222222'}),context)).status,409);
    failWrite=true;
    assert.equal((await route.PATCH(req({...body,version:edit.businessEditVersion(current),changes:{...changes,hours:'nuevo'}}),context)).status,503);
    assert.equal(current.hours,'');
    const directory=load('lib/airtable-directory.ts',{'./pilot-directory-data':load('lib/pilot-directory-data.ts'),'./business-photo':load('lib/business-photo.ts'),'@/data/directory':{toDirectoryCategory:()=> 'Profesionales y servicios'}});
    global.fetch=async url=>String(url).includes('tblZFp7SvVV7MuBWD') ? Response.json({records:[{createdTime:'2026-10-13',fields:{fldRn5vmrSMFc4xAb:[original.id],fldvfa8cy8ZV4xquD:changes.description,fld1jU61ntd250csD:changes.neighborhood,fld5XhR6GjiKu6fF3:JSON.stringify(note)}}]}) : Response.json({records:[{id:original.id,fields:{fldZAuId3Z7tmNg1y:'Prueba',fldyyLYvoyMdiK13C:'Destacado',fldGg2RLescrYR2Z6:'old',fldkT6oBXKONCkak6:'https://old.invalid'}}]});
    process.env.AIRTABLE_NEGOCIOS_TABLE_ID='tblTestOnly000000';
    const published=(await directory.loadDirectoryBusinesses())[0];
    assert.equal(published.description,changes.description);assert.equal(published.hours,'');assert.equal(published.instagram,'');
    let pages=0;
    global.fetch=async url=>{
      if(String(url).includes('tblZFp7SvVV7MuBWD')) {
        pages++;
        return String(url).includes('offset=page-two') ? Response.json({records:[{createdTime:'2026-10-13',fields:{fldRn5vmrSMFc4xAb:[original.id],fldvfa8cy8ZV4xquD:changes.description,fld5XhR6GjiKu6fF3:JSON.stringify(note)}}]}) : Response.json({records:[{createdTime:'2025-01-01',fields:{fldRn5vmrSMFc4xAb:[original.id],fldvfa8cy8ZV4xquD:'legacy',fldMsiMikQRpKW6YY:'old-hours'}}],offset:'page-two'});
      }
      return Response.json({records:[{id:original.id,fields:{fldyyLYvoyMdiK13C:'Destacado'}}]});
    };
    assert.equal((await directory.loadDirectoryBusinesses())[0].description,changes.description);assert.equal(pages,2);
    console.log('PASS: sesión, autorización por ficha, campos protegidos, validación, historial, publicación directa, reintento secuencial, conflicto de versión, fallo de Airtable y limpieza de campos. Sin escrituras reales.');
  } finally {global.fetch=oldFetch;}
})().catch(error=>{console.error(error);process.exitCode=1;});
