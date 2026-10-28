import { NextRequest, NextResponse } from 'next/server';
import { GET as readInvitation } from '../route';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
export async function POST(request: NextRequest, context: { params: { token: string } }) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: 'Entra a tu cuenta para activar la invitación.' }, { status: 401 });
  try {
    const db = getSupabaseAdminClient();
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user || !data.user.email_confirmed_at) return NextResponse.json({ error: 'Confirma tu correo e inicia sesión.' }, { status: 401 });
    const invitation = await readInvitation(request, context);
    if (!invitation.ok) return NextResponse.json({ error: 'La invitación no está disponible.' }, { status: invitation.status });
    const { business } = await invitation.json();
    const { data: owners, error: lookupError } = await db.from('business_admins').select('user_id,business_id,private_token,status').eq('business_id', business.id);
    if (lookupError) throw lookupError;
    const activeOwners=(owners||[]).filter(owner=>owner.status!=='Inactivo');
    if (activeOwners.some(owner=>owner.user_id!==data.user.id)) return NextResponse.json({ error: 'Esta ficha ya tiene una cuenta administradora. Contacta a Mercáu.' }, { status: 409 });
    const { error: saveError } = await db.from('business_admins').upsert({ user_id: data.user.id, business_id: business.id, business_name: business.name, owner_name: data.user.user_metadata?.delivery_profile?.name || data.user.user_metadata?.name || '', owner_whatsapp: business.whatsapp || '', private_token: context.params.token, status: 'Activo' }, { onConflict: 'user_id,business_id' });
    if (saveError) throw saveError;
    return NextResponse.json({ ok: true, destination: '/mi-negocio' });
  } catch {
    return NextResponse.json({ error: 'No se pudo activar la invitación. Intenta más tarde.' }, { status: 503 });
  }
}
