import { notFound } from "next/navigation";
import AccountHub from "@/components/account/AccountHub";
import BuyerExperience from "@/components/buyer/BuyerExperience";
export const metadata = {
  title: "Mi cuenta | Mercáu",
  robots: { index: false, follow: false },
};
export default async function Page(props: { params: Promise<{ section: string }> }) {
  const params = await props.params;
  if(params.section === "comprador")return <BuyerExperience section="cuenta"/>;
  if (
    ![
      "comprador",
      "negocio",
      "favoritos",
      "envios",
      "perfil",
      "notificaciones",
      "ayuda",
    ].includes(params.section)
  )
    notFound();
  return <AccountHub section={params.section} />;
}
