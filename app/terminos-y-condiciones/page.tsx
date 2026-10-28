import LegalDocument from "../../components/legal/LegalDocument";
import document from "../../content/legal/terminos-y-condiciones.json";

export const metadata = { title: "Términos y condiciones | Mercáu" };
export default function Page() { return <LegalDocument {...document} />; }
