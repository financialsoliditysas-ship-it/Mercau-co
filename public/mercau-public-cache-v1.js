/* Public assets only. No order queue, authentication responses or dynamic HTML cache. */
(function () {
  const cacheName='mercau-public-offline-v1',maxEntries=64,maxBytes=12*1024*1024;
  const atHeader='x-mercau-saved-at',sizeHeader='x-mercau-saved-size';
  self.addEventListener('install',event=>event.waitUntil((async()=>{
    try{const cache=await caches.open(cacheName);for(const path of ['/offline.html','/logo-mercau.png']){const request=new Request(new URL(path,self.location.origin));await remember(cache,request,await fetch(request));}}catch{/* Offline help must not prevent worker installation. */}
  })()));
  async function trim(cache){
    const keys=await cache.keys();let total=0;
    for(const key of keys){const response=await cache.match(key);total+=Number(response?.headers.get(sizeHeader)||0);}
    while(keys.length>maxEntries||total>maxBytes){const index=keys.findIndex(key=>!['/offline.html','/logo-mercau.png'].includes(new URL(key.url).pathname));if(index<0)break;const key=keys.splice(index,1)[0];const response=await cache.match(key);total-=Number(response?.headers.get(sizeHeader)||0);await cache.delete(key);}
  }
  async function remember(cache,request,response){
    try{
      if(!response.ok||response.redirected||response.headers.has('set-cookie'))return;
      const bytes=await response.clone().arrayBuffer();if(bytes.byteLength>1024*1024)return;
      const headers=new Headers(response.headers);headers.delete('Content-Encoding');headers.delete('Content-Length');headers.set(atHeader,String(Date.now()));headers.set(sizeHeader,String(bytes.byteLength));
      await cache.put(request,new Response(bytes,{status:response.status,headers}));await trim(cache);
    }catch{/* Storage quotas must not turn a successful network request into a failure. */}
  }
  self.addEventListener('fetch',event=>{
    const request=event.request,url=new URL(request.url);
    if(request.method!=='GET'||url.origin!==self.location.origin||request.headers.has('authorization'))return;
    const asset=/^\/_next\/static\/.+\.(js|css|woff2?)$/.test(url.pathname)||['/logo-mercau.png','/offline.html'].includes(url.pathname);
    const photo=/^\/api\/negocios\/rec[A-Za-z0-9]{14}\/(?:catalogo\/[a-f0-9-]{36}\/)?foto$/.test(url.pathname);
    if(asset||photo){
      let saving=Promise.resolve();
      const result=(async()=>{
        const cache=await caches.open(cacheName),saved=await cache.match(request);
        const age=Date.now()-Number(saved?.headers.get(atHeader)||0);
        if(asset&&saved&&(url.pathname==='/offline.html'||age<7*86400000))return saved;
        try{
          const response=await fetch(request);
          if(response.status===403||response.status===404)await cache.delete(request);
          if(asset||response.headers.get('content-type')?.startsWith('image/'))saving=remember(cache,request,response);
          return response;
        }catch(error){if(saved&&photo&&age>=0&&age<15*60000)return saved;throw error;}
      })();
      event.respondWith(result);event.waitUntil(result.then(()=>saving).catch(()=>{}));return;
    }
    if(request.mode==='navigate'&&!url.pathname.startsWith('/api/')){
      event.respondWith(fetch(request).catch(async()=>{
        const cache=await caches.open(cacheName);return await cache.match('/offline.html')||new Response('Sin conexión. Reconecta para continuar.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
      }));
    }
  });
})();
