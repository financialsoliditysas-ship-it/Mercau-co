import BuyerExperience from "@/components/buyer/BuyerExperience";
export const metadata = {
  title: "Mis pedidos | Mercáu",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <BuyerExperience section="pedidos" />;
}
