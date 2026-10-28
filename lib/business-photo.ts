import { createHash } from 'crypto';
export const photoFieldId = 'fldCDD2TZa6IjzN5c';
export const maxPhotoBytes = 2 * 1024 * 1024;
export type BusinessAttachment = {id:string;filename:string;url:string;type:string};
export function photoAttachments(value: unknown): BusinessAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(item=>item && typeof item.id==='string' && /^att[A-Za-z0-9]+$/.test(item.id));
}
export function photoVersion(attachments:BusinessAttachment[]) {
  return createHash('sha256').update(JSON.stringify(attachments.map(item=>item.id))).digest('hex');
}
export function photoDetails(businessId:string,value:unknown) {
  const attachments=photoAttachments(value);
  const image=attachments.find(item=>!/^mercau-(galeria|portada)-/.test(item.filename)&&/^image\/(jpeg|png|webp)$/i.test(item.type || ''));
  return {photoUrl:image ? `/api/negocios/${businessId}/foto?v=${image.id}` : undefined,photoKind:image?.filename?.startsWith('mercau-logo-') ? 'logo' as const : 'photo' as const,photoVersion:photoVersion(attachments)};
}
export function validatePhoto(body:Record<string,unknown>) {
  if (!['photo','logo'].includes(String(body.kind)) || !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(String(body.requestId))) throw new Error('Solicitud de imagen inválida.');
  if (typeof body.file!=='string' || body.file.length>Math.ceil(maxPhotoBytes/3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.file)) throw new Error('La imagen debe pesar menos de 2 MB.');
  const bytes=Buffer.from(body.file,'base64');
  if (bytes.length>maxPhotoBytes || bytes.toString('base64')!==body.file) throw new Error('Imagen inválida o demasiado grande.');
  let contentType='',extension='';
  if (bytes.length>=8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {contentType='image/png';extension='png';}
  else if (bytes.length>=4 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) {contentType='image/jpeg';extension='jpg';}
  else if (bytes.length>=12 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP') {contentType='image/webp';extension='webp';}
  if (!contentType) throw new Error('Selecciona una imagen JPG, PNG o WebP.');
  const hash=createHash('sha256').update(bytes).digest('hex').slice(0,16);
  return {file:body.file,contentType,filename:`mercau-${body.kind==='logo'?'logo':'foto'}-${body.requestId}-${hash}.${extension}`};
}
export function safeAttachmentUrl(value:string) {
  try {const url=new URL(value); return url.protocol==='https:' && (url.hostname.endsWith('.airtableusercontent.com') || url.hostname==='dl.airtable.com') ? url : null;}catch{return null;}
}
