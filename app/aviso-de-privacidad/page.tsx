import LegalDocument from "../../components/legal/LegalDocument";
import document from "../../content/legal/aviso-de-privacidad.json";

export const metadata = { title: "Aviso de privacidad | Mercáu" };
export default function Page() { return <LegalDocument {...document} />; }
