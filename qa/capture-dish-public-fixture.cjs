// Read-only public catalog snapshot for isolated visual review. No account or provider calls.
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../outputs/dish-discovery');
async function read(route){const response=await fetch('https://www.mercau.co'+route,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(route+' '+response.status);return response.json();}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const directory=(await read('/api/negocios')).businesses;
 const candidates=directory.filter(b=>b.municipality==='Nechí'&&b.category==='Comidas y bebidas'&&b.hasCatalog&&!b.pilotRestaurant);
 const menus={};
 for(const business of candidates){const menu=await read('/api/piloto/restaurante?mode=menu&restaurant='+business.id).catch(()=>null);if(menu?.enabled&&menu.live&&menu.menu?.length)menus[business.id]=menu;}
 const businesses=directory.filter(b=>menus[b.id]);
 if(businesses.length<2)throw new Error('Need two public enabled menus for the review');
 const images={};
 const ordered=[...businesses].sort((a,b)=>a.id.localeCompare(b.id));
 const selected=ordered.flatMap(b=>menus[b.id].menu.slice(0,18));
 for(const product of selected){if(!product.image)continue;const url=new URL(product.image,'https://www.mercau.co');url.searchParams.set('w','640');
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)continue;
  images[new URL(product.image,'https://www.mercau.co').pathname]={type:response.headers.get('content-type')||'image/webp',base64:Buffer.from(await response.arrayBuffer()).toString('base64')};
 }
 fs.writeFileSync(path.join(out,'public-fixture.json'),JSON.stringify({capturedAt:new Date().toISOString(),publicReadOnly:true,businesses,menus,images},null,2));
 console.log(JSON.stringify({restaurants:businesses.map(b=>b.name),products:Object.values(menus).reduce((n,m)=>n+m.menu.length,0),cachedPublicImages:Object.keys(images).length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
