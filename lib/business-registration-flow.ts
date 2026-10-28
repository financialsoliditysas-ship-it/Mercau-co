export const businessRegistrationPath = "/negocios/registro";
export type RegistrationAccess = { business_id: string; status: string };
export function businessRegistrationStage(input: {
  ready: boolean;
  hasSession: boolean;
  recovering: boolean;
  loading: boolean;
  hasData: boolean;
  businesses: RegistrationAccess[];
}) {
  if (!input.ready || (input.hasSession && input.loading && !input.hasData)) return "loading" as const;
  if (!input.hasSession || input.recovering) return "auth" as const;
  return input.businesses.some((business) => business.status === "Activo")
    ? "panel" as const
    : "register" as const;
}
