type Period = { start: string; end: string };
type Day = { closed: boolean; periods: Period[] };
const clock = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function businessOrderHours(value: unknown, now = new Date()) {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  if (data.temporaryClosed === true) return { open: false, message: 'Cerrado temporalmente. Consulta el horario del negocio.' };
  const parts = Object.fromEntries(clock.formatToParts(now).map(part => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`, time = `${parts.hour}:${parts.minute}`;
  const special = Array.isArray(data.specialHours) ? data.specialHours.find(day => day?.date === date) : undefined;
  // Missing structured hours do not justify inventing a schedule or closing a business.
  if (!special && data.schedule == null) return { open: true, message: '' };
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const day = special || (Array.isArray(data.schedule) && data.schedule.length === 7 ? data.schedule[weekday] : null) as Day | null;
  if (!day || typeof day.closed !== 'boolean' || !Array.isArray(day.periods)) return { open: false, message: 'Horario por confirmar. No se reciben pedidos en este momento.' };
  if (day.closed) return { open: false, message: 'Cerrado según el horario guardado del negocio.' };
  const validTime = (value: unknown): value is string => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!day.periods.length || !day.periods.every((p: Period) => validTime(p?.start) && validTime(p?.end) && p.start < p.end)) return { open: false, message: 'Horario por confirmar. No se reciben pedidos en este momento.' };
  const open = day.periods.some((p: Period) => p.start <= time && time < p.end);
  return { open, message: open ? '' : `Cerrado. Horario de hoy: ${day.periods.map((p: Period) => `${p.start}–${p.end}`).join(' / ')} (hora de Colombia).` };
}
