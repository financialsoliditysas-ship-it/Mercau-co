export type DispatchScheduleInput = {
  acceptedAt: Date | string;
  preparationMinutes?: number | null;
  dispatchLeadMinutes?: number | null;
};

export function computeRestaurantDispatchDueAt(input: DispatchScheduleInput): Date {
  const acceptedAt = input.acceptedAt instanceof Date ? input.acceptedAt : new Date(input.acceptedAt);
  if (Number.isNaN(acceptedAt.getTime())) throw new Error('La hora de aceptación no es válida.');
  const preparationMinutes = Number.isFinite(input.preparationMinutes) && Number(input.preparationMinutes) > 0
    ? Number(input.preparationMinutes) : 15;
  const dispatchLeadMinutes = Number.isFinite(input.dispatchLeadMinutes) && Number(input.dispatchLeadMinutes) >= 0
    ? Number(input.dispatchLeadMinutes) : 3;
  const delayMinutes = Math.max(preparationMinutes - dispatchLeadMinutes, 0);
  return new Date(acceptedAt.getTime() + delayMinutes * 60_000);
}

export function advanceRestaurantDispatchDueAt(now: Date | string): Date {
  const value = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(value.getTime())) throw new Error('La hora de disponibilidad no es válida.');
  return value;
}

export function isRestaurantDispatchDue(dueAt: Date | string | null | undefined, now: Date | string): boolean {
  if (!dueAt) return false;
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  const current = now instanceof Date ? now : new Date(now);
  return !Number.isNaN(due.getTime()) && !Number.isNaN(current.getTime()) && due.getTime() <= current.getTime();
}
