require('./integral-fixtures.cjs');
if(process.env.MERCAU_FINDINGS_TEST==='1'){
 const previous=global.fetch;
 global.fetch=async(input,options)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
  const response=await previous(input,options);
  if(url.origin!=='http://127.0.0.1:54329'||!url.pathname.endsWith('/business_catalog_products'))return response;
  const products=await response.json();
  if(!url.searchParams.get('business_id')?.includes('rec'+'Q'.repeat(14)))return Response.json(products);
  return Response.json(Array.from({length:15},(_,index)=>({...products[0],id:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,name:'Plato QA '+(index+1),section:['Entradas','Asados','Bebidas'][Math.floor(index/5)],position:index})));
 };
}
