import { createHash } from 'crypto';
export const pilotBusinessName='Restaurante Mercado [PRUEBA]';
export const pilotMarker={kind:'pilot_restaurant',pilotId:'restaurante-mercado'};
export function isPilotBusinessNote(value:unknown) {
  try {const note=JSON.parse(String(value || ''));return note.kind===pilotMarker.kind && note.pilotId===pilotMarker.pilotId;}catch{return false;}
}
export function pilotProductUuid(businessId:string,productId:string) {
  const hex=createHash('sha256').update(`${businessId}:restaurante-mercado:${productId}`).digest('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-8${hex.slice(13,16)}-${((parseInt(hex[16],16)&3)|8).toString(16)}${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
export function pilotImageAllowed(path:string) {
  return /^\/demo-(burger|double|steak|ribs|fries|shake)\.jpg$/.test(path);
}
