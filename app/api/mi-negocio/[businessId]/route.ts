import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { loadDirectoryBusiness } from '@/lib/airtable-directory';
import { businessEditValues, businessEditVersion, validateBusinessEdit } from '@/lib/business-edit';
import { GET as readPrivateBusiness } from '@/app/api/actualizaciones/[token]/route';

export const dynamic = 'force-dynamic';
type Context = { params: { businessId: string } };
class EditError extends Error { constructor(message: string, public status: number) { super(message); } }
async function authorizedBusiness(request: NextRequest, businessId: string) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new EditError('Entra a tu cuenta para editar la ficha.',401);
  if (!/^rec[A-Za-z0-9]{14}$/.test(businessId)) throw new EditError('Ficha no válida.',400);
  const db = getSupabaseAdminClient();
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user || !auth.user.email_confirmed_at) throw new EditError('Confirma tu correo e inicia sesión.',401);
  const { data: access, error } = await db.from('business_admins').select('private_token').eq('user_id',auth.user.id).eq('business_id',businessId).eq('status','Activo').maybeSingle();
  if (error) throw new EditError('No se pudo comprobar tu acceso.',503);
  if (!access) throw new EditError('No tienes permiso para editar esta ficha.',403);
  const privateResponse = await readPrivateBusiness(request,{params:{token:access.private_token}});
  if (!privateResponse.ok) throw new EditError('La vinculación necesita revisión de Mercáu.',403);
  const privateBusiness = (await privateResponse.json()).business;
  if (privateBusiness?.id !== businessId) throw new EditError('La vinculación necesita revisión de Mercáu.',403);
  const business = await loadDirectoryBusiness(businessId) || {
    ...privateBusiness,
    source: 'Airtable',
  };
  return { business, user: auth.user };
}
function fail(error: unknown) {
  return NextResponse.json({error:error instanceof EditError ? error.message : 'No se pudo completar la operación. Intenta más tarde.'},{status:error instanceof EditError ? error.status : 503});
}
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { business } = await authorizedBusiness(request,params.businessId);
    return NextResponse.json({business,version:businessEditVersion(business)},{headers:{'Cache-Control':'no-store'}});
  } catch (error) { return fail(error); }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const { business, user } = await authorizedBusiness(request,params.businessId);
    const text = await request.text();
    if (text.length > 16000) throw new EditError('La edición es demasiado larga.',400);
    let body: Record<string, unknown>;
    try { body = JSON.parse(text); } catch { throw new EditError('Datos inválidos.',400); }
    if (!body || typeof body !== 'object' || !/^[a-f0-9-]{36}$/i.test(String(body.requestId || ''))) throw new EditError('Solicitud inválida.',400);
    let after;
    try { if(!body.changes||typeof body.changes!=='object'||Array.isArray(body.changes))throw new Error('Datos inválidos.');after = validateBusinessEdit({...businessEditValues(business),...body.changes}); } catch (error) { throw new EditError(error instanceof Error ? error.message : 'Revisa los datos.',400); }
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableId = process.env.AIRTABLE_ACTUALIZACIONES_TABLE_ID || 'tblZFp7SvVV7MuBWD';
    if (!apiKey || !baseId) throw new EditError('El guardado no está disponible.',503);
    const name = `Edición directa ${body.requestId}`;
    const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;
    const query = new URLSearchParams({filterByFormula:`{Solicitud} = '${name}'`,returnFieldsByFieldId:'true',pageSize:'1'});
    const priorResponse = await fetch(`${url}?${query}`,{headers:{Authorization:`Bearer ${apiKey}`},cache:'no-store'});
    if (!priorResponse.ok) throw new EditError('No se pudo comprobar el guardado anterior.',503);
    const prior = (await priorResponse.json()).records?.[0];
    if (prior) {
      let note;
      try { note = JSON.parse(prior.fields?.fld5XhR6GjiKu6fF3 || ''); } catch { throw new EditError('Solicitud repetida no válida.',409); }
      if (note.actor_id !== user.id || note.business_id !== business.id || JSON.stringify(note.after) !== JSON.stringify(after)) throw new EditError('Solicitud repetida con datos diferentes. Vuelve a abrir la ficha.',409);
      return NextResponse.json({ok:true,message:'Tus cambios ya quedaron guardados.'});
    }
    if (body.version !== businessEditVersion(business)) throw new EditError('La ficha cambió desde que la abriste. Recárgala antes de guardar.',409);
    const before = businessEditValues(business);
    if (JSON.stringify(before) === JSON.stringify(after)) return NextResponse.json({ok:true,message:'No hay cambios para guardar.'});
    const fields = {
      fldw0euO9G9yzQolB:name, fldRn5vmrSMFc4xAb:[business.id], fldxcaBA32ryuBUya:'Aplicada',
      fldvfa8cy8ZV4xquD:after.description, fld1jU61ntd250csD:after.neighborhood, fldMsiMikQRpKW6YY:after.hours,
      fldxITFwlegSY2hFp:after.deliveries, fldb37RSOmv5op09a:after.instagram, fldyyeqCumnxqjG3x:after.facebook,
      fldDn2C4jBQQjD3yG:after.mapsUrl, fldjY6CEsYHyJnBbQ:after.whatsapp || business.whatsapp,
      fld5XhR6GjiKu6fF3:JSON.stringify({kind:'owner_edit',actor_id:user.id,business_id:business.id,request_id:body.requestId,before,after,created_at:new Date().toISOString()})
    };
    const response = await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({records:[{fields}]})});
    if (!response.ok) throw new EditError('No se pudo guardar. Tus datos siguen en el formulario; intenta nuevamente.',503);
    return NextResponse.json({ok:true,message:'Cambios guardados. Tu ficha pública está actualizada.'});
  } catch (error) { return fail(error); }
}
