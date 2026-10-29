require('./integral-fixtures.cjs');
if(process.env.MERCAU_IMAGE_TEST==='1'){
 const fs=require('node:fs'),previous=globalThis.fetch;
 const source=fs.readFileSync(process.env.MERCAU_QA_IMAGE);
 globalThis.fetch=async(input,options)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
  if(process.env.MERCAU_IMAGE_TRACE==='1'&&url.hostname==='api.airtable.com'&&url.pathname==='/v0/qa-navigation/businesses')console.log('QA_PUBLIC_DIRECTORY_READ');
  if(url.hostname==='api.airtable.com'&&/\/businesses\/rec[QS]{14}$/.test(url.pathname))return Response.json({fields:{fldyyLYvoyMdiK13C:'Publicado'}});
  if(url.origin==='http://127.0.0.1:54329'&&url.pathname.startsWith('/storage/v1/object/'))return new Response(source,{headers:{'Content-Type':'image/jpeg'}});
  const response=await previous(input,options);
  if(url.origin!=='http://127.0.0.1:54329'||!url.pathname.endsWith('/business_catalog_products'))return response;
  const data=await response.json(),rows=data.flatMap(row=>Array.from({length:8},(_,index)=>{
   const id=`00000000-0000-4000-8000-${String((row.business_id.includes('Q')?100:200)+index).padStart(12,'0')}`;
   return {...row,id,name:'Producto QA '+(index+1),image_path:`${row.business_id}/${id}/qa.jpg`,position:index,version:1};
  }));
  const id=url.searchParams.get('id')?.replace(/^eq\./,'');
  return Response.json(id?rows.filter(row=>row.id===id):rows);
 };
}
