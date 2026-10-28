import AccountHub from "@/components/account/AccountHub";
export const metadata = {
  title: "Mis pedidos | Mercáu",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AccountHub section="pedidos" />;
}
