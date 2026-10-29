export function catalogImageSources(imageUrl:string|undefined,original=false) {
  if(!imageUrl || original || !/^\/api\/negocios\/rec[A-Za-z0-9]{14}\/catalogo\/[a-f0-9-]{36}\/foto(?:\?|$)/.test(imageUrl))return {src:imageUrl};
  const url=new URL(imageUrl,'https://www.mercau.co');
  const sized=(width:number)=>{url.searchParams.set('w',String(width));return url.pathname+url.search;};
  return {src:sized(640),srcSet:[320,640,960].map(width=>`${sized(width)} ${width}w`).join(', ')};
}
