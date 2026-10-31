// Public presentation only. Not for authentication, permissions, prices at checkout or writes.
export function publicReadCache<T>(ttlMs:number,maxEntries=64) {
  const saved=new Map<string,{value:T;until:number}>(),pending=new Map<string,Promise<T>>();
  return async (key:string,load:()=>Promise<T>):Promise<T>=>{
    const hit=saved.get(key);if(hit&&hit.until>Date.now())return hit.value;
    const active=pending.get(key);if(active)return active;
    if(pending.size>=maxEntries)return load();
    const work=load().then(value=>{
      saved.delete(key);while(saved.size>=maxEntries)saved.delete(saved.keys().next().value as string);
      saved.set(key,{value,until:Date.now()+ttlMs});return value;
    }).finally(()=>pending.delete(key));
    pending.set(key,work);return work;
  };
}
