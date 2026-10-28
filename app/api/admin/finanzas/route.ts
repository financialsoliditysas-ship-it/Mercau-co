import { NextResponse } from 'next/server';
import { confirmOrderPayment, getFinanceDashboard } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const password = process.env.ADMIN_METRICS_PASSWORD;
  if (!password || request.headers.get('x-admin-password') !== password) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await getFinanceDashboard()) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'No se pudo cargar el libro.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const password = process.env.ADMIN_METRICS_PASSWORD;
  if (!password || request.headers.get('x-admin-password') !== password) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 });
  }
  try {
    const body = await request.json();
    if (body?.action !== 'confirm_payment') return NextResponse.json({ ok: false, error: 'Acción inválida.' }, { status: 400 });
    return NextResponse.json({ ok: true, result: await confirmOrderPayment(String(body.snapshotId || ''), String(body.reference || '')) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'No se pudo confirmar el pago.' }, { status: 400 });
  }
}
