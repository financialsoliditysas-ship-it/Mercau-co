import { directoryMunicipalities } from "@/data/directory";
export const deliveryLabels: Record<string, string> = {
  created: "Solicitud recibida",
  sent_to_shipday: "Buscando mensajero",
  integration_error: "Solicitud recibida; despacho en revisión",
  assigned: "Mensajero asignado",
  picked_up: "Recogido",
  in_transit: "En camino",
  delivered: "Entregado",
  cancelled: "Cancelado",
  failed: "No se pudo completar",
};
export type AccountProfile = {
  name: string;
  phone: string;
  whatsapp: string;
  municipality: string;
  neighborhood: string;
  address: string;
  instructions: string;
  addresses: { label: string; address: string; municipality: string }[];
  notifications: { orders: boolean; deliveries: boolean; marketing: boolean };
};
export const emptyAccountProfile: AccountProfile = {
  name: "",
  phone: "",
  whatsapp: "",
  municipality: "",
  neighborhood: "",
  address: "",
  instructions: "",
  addresses: [],
  notifications: { orders: true, deliveries: true, marketing: false },
};
export function legacyAccountProfile(
  metadata: Record<string, unknown>,
): AccountProfile {
  const p =
    metadata.delivery_profile && typeof metadata.delivery_profile === "object"
      ? (metadata.delivery_profile as Record<string, unknown>)
      : {};
  return {
    ...emptyAccountProfile,
    ...Object.fromEntries(
      [
        "name",
        "phone",
        "whatsapp",
        "municipality",
        "neighborhood",
        "address",
        "instructions",
      ].map((key) => [
        key,
        typeof p[key] === "string"
          ? p[key]
          : key === "name" && typeof metadata.name === "string"
            ? metadata.name
            : "",
      ]),
    ),
  };
}
export function validateAccountProfile(value: unknown): AccountProfile {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Revisa tus datos.");
  const p = value as Record<string, unknown>;
  if (Object.keys(p).some((k) => !(k in emptyAccountProfile)))
    throw new Error("Hay datos no permitidos.");
  const text = (key: string, max: number) => {
    if (typeof p[key] !== "string" || String(p[key]).length > max)
      throw new Error("Revisa la longitud de los datos.");
    return String(p[key]).trim();
  };
  const phone = (key: string) => {
    const original = text(key, 30);
    const raw = original.replace(/\D/g, "").replace(/^57(?=3\d{9}$)/, "");
    if (original && !/^3\d{9}$/.test(raw))
      throw new Error("Escribe un celular colombiano de 10 dígitos.");
    return raw ? `+57${raw}` : "";
  };
  const name = text("name", 120),
    municipality = text("municipality", 60),
    neighborhood = text("neighborhood", 120);
  if (
    !name ||
    !directoryMunicipalities.includes(
      municipality as (typeof directoryMunicipalities)[number],
    )
  )
    throw new Error("Completa tu nombre y municipio.");
  const addresses = Array.isArray(p.addresses) ? p.addresses : [];
  if (addresses.length > 5)
    throw new Error("Puedes guardar hasta cinco direcciones.");
  const cleanAddresses = addresses.map((a) => {
    if (
      !a ||
      typeof a !== "object" ||
      typeof a.label !== "string" ||
      typeof a.address !== "string" ||
      a.label.length > 40 ||
      !a.address.trim() ||
      a.address.length > 240 ||
      !directoryMunicipalities.includes(a.municipality)
    )
      throw new Error("Revisa tus direcciones frecuentes.");
    return {
      label: a.label.trim(),
      address: a.address.trim(),
      municipality: a.municipality,
    };
  });
  const n = p.notifications as AccountProfile["notifications"];
  if (
    !n ||
    ["orders", "deliveries", "marketing"].some(
      (k) => typeof n[k as keyof typeof n] !== "boolean",
    )
  )
    throw new Error("Revisa tus preferencias.");
  return {
    name,
    municipality,
    neighborhood,
    phone: phone("phone"),
    whatsapp: phone("whatsapp"),
    address: text("address", 240),
    instructions: text("instructions", 400),
    addresses: cleanAddresses,
    notifications: {
      orders: n.orders,
      deliveries: n.deliveries,
      marketing: n.marketing,
    },
  };
}
export function businessCompletion(b: Record<string, unknown>) {
  const checks = [
    ["Descripción", b.description],
    ["Dirección", b.neighborhood],
    ["Horario", b.hours],
    ["Foto principal o logo", b.photoUrl],
    ["WhatsApp", b.whatsapp],
    ["Ubicación en Maps", b.mapsUrl],
  ];
  const pending = checks
    .filter(([, value]) => !value)
    .map(([label]) => String(label));
  return {
    percent: Math.round(
      ((checks.length - pending.length) / checks.length) * 100,
    ),
    pending,
  };
}
