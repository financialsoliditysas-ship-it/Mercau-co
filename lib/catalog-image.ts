import { createHash } from 'node:crypto';
import sharp from 'sharp';

type Image={bytes:Buffer;type:string};
const images=new Map<string,{image:Image;until:number}>();
const pending=new Map<string,Promise<Image>>();
const waiting:Array<()=>void>=[];
const maxBytes=16*1024*1024,maxEntries=64,maxPending=16;
let bytes=0,active=0;
export function catalogImageWidth(value:string|null):number|null {
  return value===null?null:['320','640','960'].includes(value)?Number(value):NaN;
}
export function catalogImageTag(businessId:string,productId:string,imagePath:string,version:number,width:number|null,webp:boolean) {
  return '"'+createHash('sha256').update(JSON.stringify(['image-v1',businessId,productId,imagePath,version,width,webp])).digest('hex')+'"';
}
export function imageTagMatches(header:string|null,etag:string) {
  return Boolean(header?.split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===etag));
}
async function inSlot<T>(work:()=>Promise<T>) {
  if(active>=2)await new Promise<void>(resolve=>waiting.push(resolve));else active++;
  try{return await work();}finally{const next=waiting.shift();if(next)next();else active--;}
}
function remove(key:string) {const item=images.get(key);if(item){bytes-=item.image.bytes.length;images.delete(key);}}
function remember(key:string,image:Image) {
  if(image.bytes.length>maxBytes)return;
  remove(key);
  while(images.size>=maxEntries || bytes+image.bytes.length>maxBytes){const first=images.keys().next().value;if(first===undefined)break;remove(first);}
  images.set(key,{image,until:Date.now()+60000});bytes+=image.bytes.length;
}
// Call only after fresh publication/path checks. This cache contains bytes, not permissions.
export async function catalogImage(key:string,load:()=>Promise<Image>,width:number|null,webp:boolean):Promise<Image> {
  const cached=images.get(key);
  if(cached&&cached.until>Date.now()){images.delete(key);images.set(key,cached);return cached.image;}
  remove(key);
  const existing=pending.get(key);if(existing)return existing;
  // Bound transformation work; under overload retain the existing original-image behavior.
  if(pending.size>=maxPending)return load();
  const work=inSlot(async()=>{
    const original=await load();let image=original;
    if(width && original.bytes.length<=2*1024*1024 && /^image\/(jpeg|png|webp)$/i.test(original.type)) {
      try{
        const pipeline=sharp(original.bytes,{limitInputPixels:8*1024*1024,failOn:'warning'}).rotate().resize({width,withoutEnlargement:true});
        const output=webp?await pipeline.webp({quality:78,effort:3}).toBuffer():original.type==='image/png'?await pipeline.png().toBuffer():await pipeline.jpeg({quality:78}).toBuffer();
        if(output.length<original.bytes.length)image={bytes:output,type:webp?'image/webp':original.type==='image/png'?'image/png':'image/jpeg'};
      }catch{ /* A failed resize must not hide an otherwise valid original photo. */ }
    }
    remember(key,image);return image;
  });
  pending.set(key,work);
  try{return await work;}finally{pending.delete(key);}
}
