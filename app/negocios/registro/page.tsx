import BusinessRegistrationEntry from "@/components/account/BusinessRegistrationEntry";
export const metadata = {
  title: "Registra tu negocio | Mercáu",
  description: "Registra gratis tu negocio, crea su página y publica su catálogo o menú en Mercáu.",
};
export default function Page({ searchParams }: { searchParams?: { plan?: string } }) {
  const selectedPlan = typeof searchParams?.plan === "string" ? searchParams.plan.slice(0, 80) : "";
  return <BusinessRegistrationEntry selectedPlan={selectedPlan} />;
}
