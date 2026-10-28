import LegalDocument from "../../components/legal/LegalDocument";
import document from "../../content/legal/politica-de-tratamiento-de-datos.json";

export const metadata = { title: "Política de tratamiento de datos | Mercáu" };
export default function Page() { return <LegalDocument {...document} />; }
