import { notFound } from "next/navigation";
import AccountHub from "@/components/account/AccountHub";
export const metadata = {
  title: "Mi cuenta | Mercáu",
  robots: { index: false, follow: false },
};
export default function Page({ params }: { params: { section: string } }) {
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
