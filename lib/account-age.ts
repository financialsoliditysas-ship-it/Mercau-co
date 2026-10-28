export const minimumAccountAge = 18;
export const invalidBirthDateMessage =
  "Ingresa una fecha de nacimiento válida.";
export const futureBirthDateMessage =
  "La fecha de nacimiento no puede estar en el futuro.";
export const minimumAgeMessage =
  "Para crear una cuenta en Mercáu debes tener 18 años cumplidos.";

function dateParts(value: string): [number, number, number] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= monthDays[month - 1] ? [year, month, day] : null;
}
export function accountToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function birthDateError(value: unknown, today = accountToday()): string {
  const birth = typeof value === "string" ? dateParts(value) : null;
  const current = dateParts(today);
  if (!birth || !current) return invalidBirthDateMessage;
  if (String(value) > today) return futureBirthDateMessage;
  const [year, month, day] = birth,
    [thisYear, thisMonth, thisDay] = current;
  const age =
    thisYear -
    year -
    (thisMonth < month || (thisMonth === month && thisDay < day) ? 1 : 0);
  return age >= minimumAccountAge ? "" : minimumAgeMessage;
}
export function latestAdultBirthDate(today = accountToday()): string {
  const current = dateParts(today);
  if (!current) throw new Error("Invalid current date");
  const [year, month, day] = current;
  const prefix = `${String(year - minimumAccountAge).padStart(4, "0")}-${String(month).padStart(2, "0")}-`;
  const candidate = `${prefix}${String(day).padStart(2, "0")}`;
  return dateParts(candidate) ? candidate : `${prefix}28`;
}
export function isBirthDateMessage(message: string): boolean {
  return [
    invalidBirthDateMessage,
    futureBirthDateMessage,
    minimumAgeMessage,
  ].includes(message);
}
