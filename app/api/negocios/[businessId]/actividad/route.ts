import { NextResponse } from 'next/server';
import { loadDirectoryBusiness } from '@/lib/airtable-directory';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
export async function POST(request:Request,{params}:{params:{businessId:string}}){try{
  if(!/^rec[A-Za-z0-9]{14}$/.test(params.businessId))return new NextResponse(null,{status:400});
  const raw=await request.text();if(raw.length>150)return new NextResponse(null,{status:400});
  const {event}=JSON.parse(raw);if(!['profile_view','whatsapp_click','call_click'].includes(event))return new NextResponse(null,{status:400});
  if(!await loadDirectoryBusiness(params.businessId))return new NextResponse(null,{status:404});
  const {error}=await getSupabaseAdminClient().rpc('record_business_activity',{p_business:params.businessId,p_event:event});
  return new NextResponse(null,{status:error?503:204,headers:{'Cache-Control':'no-store'}});
}catch{return new NextResponse(null,{status:400});}}
