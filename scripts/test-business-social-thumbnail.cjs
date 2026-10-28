const fs=require('node:fs');
const catalog=fs.readFileSync('app/negocios/[id]/catalogo/page.tsx','utf8');
const business=fs.readFileSync('app/negocios/[id]/page.tsx','utf8');
const image=fs.readFileSync('app/api/negocios/[businessId]/og/route.ts','utf8');
function has(source,value,message){if(!source.includes(value))throw new Error(message);}
has(catalog,'width:1200,height:630','El menú o catálogo debe declarar la medida social.');
has(catalog,"photoVersion||'1'",'La miniatura debe cambiar cuando cambia el logo.');
has(business,'/og?v=${business.photoVersion','La ficha debe reutilizar la miniatura profesional.');
has(image,'business.photoUrl','La imagen social debe utilizar el logo o foto del negocio.');
has(image,"'Content-Type': image.contentType",'La miniatura debe responder como una imagen real.');
has(image,"'/og-mercau.jpg'",'Debe existir una imagen de respaldo cuando el negocio no tenga logo.');
console.log('PASS business social thumbnail metadata.');
