const assert=require('node:assert/strict');
const fs=require('node:fs');
const Module=require('node:module');
const ts=require('typescript');
function load(path,mocks={}) {
  const mod=new Module(path);mod.require=id=>id in mocks?mocks[id]:require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,path+'.cjs');return mod.exports;
}
const photo=load('lib/business-photo.ts');
const {NextRequest}=require('next/server');
const id='recXRpTxUmzbiZYLO',context={params:{businessId:id}};
const original={id:'attOriginal123',filename:'original.jpg',type:'image/jpeg',url:'https://v5.airtableusercontent.com/example'};
let attachments=[original],denied=0,uploads=0,fail=false;
const route=load('app/api/mi-negocio/[businessId]/foto/route.ts',{
  '../route':{GET:async()=>denied?Response.json({}, {status:denied}):Response.json({business:{id}})},
  '@/lib/business-photo':photo
});
const publicRoute=load('app/api/negocios/[businessId]/foto/route.ts',{'@/lib/business-photo':photo,'@/lib/supabase-admin':{getSupabaseAdminClient:()=>({})}});
const file=Buffer.from([255,216,255,224,0,0]).toString('base64');
const body={file,kind:'logo',requestId:'11111111-1111-4111-8111-111111111111',photoVersion:photo.photoVersion(attachments)};
const request=payload=>new NextRequest('https://example.invalid/api/mi-negocio/'+id+'/foto',{method:'POST',body:JSON.stringify(payload)});
const oldFetch=global.fetch;
process.env.AIRTABLE_API_KEY='test-only';process.env.AIRTABLE_BASE_ID='appTest';process.env.AIRTABLE_NEGOCIOS_TABLE_ID='tblTest';
global.fetch=async(url,options={})=>{
  if(String(url).includes('content.airtable.com')) {
    uploads++;if(fail)return Response.json({}, {status:500});
    const upload=JSON.parse(options.body);assert.equal(upload.contentType,'image/jpeg');
    attachments.push({id:'attAdded123',filename:upload.filename,type:upload.contentType,url:original.url});
  }
  if(options.method==='PATCH') {
    const ids=JSON.parse(options.body).fields[photo.photoFieldId];
    assert(ids.some(item=>item.id===original.id));attachments=ids.map(item=>attachments.find(a=>a.id===item.id));
  }
  return Response.json({id,fields:{[photo.photoFieldId]:attachments}});
};
(async()=>{try {
  assert.equal(photo.photoDetails(id,[]).photoUrl,undefined);
  assert(photo.safeAttachmentUrl(original.url));
  assert.equal(photo.safeAttachmentUrl('https://airtableusercontent.com.evil.invalid/x'),null);
  assert.equal(photo.safeAttachmentUrl('http://dl.airtable.com/x'),null);
  for(const bad of [{...body,file:'PHN2Zz4='},{...body,kind:'evil'},{...body,file:'A'.repeat(3000000)}])assert.throws(()=>photo.validatePhoto(bad));
  denied=401;assert.equal((await route.POST(request(body),context)).status,401);
  denied=403;assert.equal((await route.POST(request(body),context)).status,403);denied=0;
  assert.equal(uploads,0);
  assert.equal((await route.POST(request({...body,photoVersion:'stale'}),context)).status,409);
  const saved=await route.POST(request(body),context);assert.equal(saved.status,200);
  const data=await saved.json();assert.equal(data.photoKind,'logo');assert(data.photoUrl.endsWith('attAdded123'));
  assert.equal(attachments.length,2);assert.equal(attachments[1].id,original.id);
  assert.equal((await route.POST(request(body),context)).status,200);assert.equal(uploads,1);
  fail=true;assert.equal((await route.POST(request({...body,requestId:'22222222-2222-4222-8222-222222222222',photoVersion:data.photoVersion}),context)).status,503);
  assert.equal(attachments.length,2);
  let published=true;
  global.fetch=async()=>Response.json({fields:{fldyyLYvoyMdiK13C:published?'Destacado':'Pendiente',[photo.photoFieldId]:attachments}});
  const imageResponse=await publicRoute.GET(request(body),context);assert.equal(imageResponse.status,302);assert(imageResponse.headers.get('location').startsWith('https://v5.airtableusercontent.com/'));
  published=false;assert.equal((await publicRoute.GET(request(body),context)).status,404);
  assert.equal((await publicRoute.GET(request(body),{params:{businessId:'bad'}})).status,404);
  console.log('PASS photo validation, auth, conflict, upload, preservation, retry and failed upload');
}finally{global.fetch=oldFetch;}})().catch(error=>{console.error(error);process.exitCode=1;});
