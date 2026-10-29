const restaurantId='rec'+'Q'.repeat(14),shopId='rec'+'S'.repeat(14);
const businesses=[
  {id:restaurantId,name:'Restaurante QA ficticio',category:'Comidas y bebidas',slug:'restaurante-qa-ficticio'},
  {id:shopId,name:'Comercio QA ficticio',category:'Moda y accesorios',slug:'comercio-qa-ficticio'},
];
module.exports={businesses,restaurantId,shopId};
if(process.env.MERCAU_NAVIGATION_TEST==='1'){
  const net=require('node:net'),allowed=new Set(['127.0.0.1','localhost','::1','[::1]']);
  const connect=net.Socket.prototype.connect,originalFetch=globalThis.fetch;
  net.Socket.prototype.connect=function(...args){
    const options=args[0];
    if(options&&typeof options==='object'&&!Array.isArray(options)){
      if(options.host&&!allowed.has(options.host))throw Error('External socket forbidden in navigation QA');
    }else if(typeof args[1]==='string'&&!allowed.has(args[1]))throw Error('External socket forbidden in navigation QA');
    return connect.apply(this,args);
  };
  const safeFetch=(input,options)=>{
    const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
    if(!allowed.has(url.hostname))throw Error('External fetch forbidden in navigation QA');
    return originalFetch(input,options);
  };
  const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
  globalThis.fetch=async(input,options={})=>{
    const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
    const method=String(options.method||input.method||'GET').toUpperCase();
    if(url.hostname==='api.airtable.com'){
      if(method!=='GET'||!url.pathname.startsWith('/v0/qa-navigation/'))throw Error('Non-fixture Airtable request blocked');
      return json({records:url.pathname==='/v0/qa-navigation/businesses'?businesses.map(b=>({id:b.id,fields:{fldZAuId3Z7tmNg1y:b.name,fldyp3od5rTBa74il:b.category,fldAziT6B2rW6HcyT:'Nechí',fldyyLYvoyMdiK13C:'Publicado',fldlAXHZlQY2PLtvX:'Datos ficticios de regresion de navegacion.'}})):[]});
    }
    if(url.origin==='http://127.0.0.1:54329'){
      if(method!=='GET')throw Error('Fixture writes forbidden');
      const table=url.pathname.split('/').pop();
      if(table==='business_public_links')return json(businesses.map(b=>({business_id:b.id,slug:b.slug})));
      if(table==='pilot_restaurants')return json({is_live:false});
      if(table==='business_catalog_products'){
        const filter=url.searchParams.get('business_id');
        return json(businesses.filter(b=>!filter||filter.includes(b.id)).map(b=>({id:`00000000-0000-4000-8000-00000000000${b.id===restaurantId?1:2}`,business_id:b.id,name:b.id===restaurantId?'Plato QA ficticio':'Producto QA ficticio',description:'Solo prueba local, no disponible para compra.',section:'Prueba',price:10000,available:true,status:'published',position:0,option_groups:[],version:1,image_path:null,updated_at:'2026-10-28T00:00:00Z'})));
      }
      throw Error('Unknown fixture table '+table);
    }
    return safeFetch(input,options);
  };
}
