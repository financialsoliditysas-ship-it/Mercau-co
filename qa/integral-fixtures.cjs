// Used only by the local regression runner; never by the deployed application.
const fixture=require('./presentation-navigation-fixtures.cjs');
module.exports=fixture;
if(process.env.MERCAU_INTEGRAL_TEST==='1'){
 const fallback=globalThis.fetch;
 const group={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Adiciones',type:'multiple',required:false,minSelections:0,maxSelections:1,choices:[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Queso QA',priceDelta:3000,defaultSelected:false}]};
 globalThis.fetch=async(input,options)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
  if(url.origin==='http://127.0.0.1:54329'&&url.pathname.endsWith('/pilot_restaurants'))return Response.json({id:fixture.restaurantId,is_live:true,directory_initialized:true,directory_business_id:fixture.restaurantId,enabled:true,delivery_fee:5000,delivery_mode:'MERCAU',menu:[]});
  if(url.origin==='http://127.0.0.1:54329'&&url.pathname.endsWith('/business_catalog_products')){
   const response=await fallback(input,options),products=await response.json();
   return Response.json(products.map(product=>({...product,option_groups:product.business_id===fixture.restaurantId?[group]:[],description:'Descripción ficticia completa para comprobar el detalle del producto sin truncamiento.'})));
  }
  return fallback(input,options);
 };
}
