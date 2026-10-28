import { NextResponse } from 'next/server';
import { getOperationsDashboard, recordSettlementBatch } from '@/lib/operations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const password = process.env.ADMIN_METRICS_PASSWORD;
  if (!password || request.headers.get('x-admin-password') !== password) return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await getOperationsDashboard()) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'No se pudo cargar la operación.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const password = process.env.ADMIN_METRICS_PASSWORD;
  if (!password || request.headers.get('x-admin-password') !== password) return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 });
  try {
    const body = await request.json();
    if (body?.action !== 'record_settlement') return NextResponse.json({ ok: false, error: 'Acción inválida.' }, { status: 400 });
    return NextResponse.json({ ok: true, results: await recordSettlementBatch(body) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'No se pudo registrar la liquidación.' }, { status: 400 });
  }
}
