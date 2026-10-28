import Link from "next/link";
import styles from "./LegalDocument.module.css";

type LegalSection = { heading: string; paragraphs: string[] };

export default function LegalDocument({
  title,
  sections,
}: {
  title: string;
  sections: LegalSection[];
}) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">Mercáu</Link>
        <Link className={styles.back} href="/mi-cuenta">Mi cuenta</Link>
      </header>
      <article className={styles.document}>
        <p className={styles.eyebrow}>Documento legal</p>
        <h1>{title}</h1>
        <p className={styles.intro}>
          Consulta las condiciones y reglas aplicables al uso de Mercáu.
        </p>
        {sections.map((section, index) => (
          <section key={`${section.heading}-${index}`}>
            {section.heading && <h2>{section.heading}</h2>}
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex}>{paragraph}</p>
            ))}
          </section>
        ))}
      </article>
      <nav className={styles.links} aria-label="Documentos legales">
        <Link href="/terminos-y-condiciones">Términos y condiciones</Link>
        <Link href="/politica-de-tratamiento-de-datos">Tratamiento de datos</Link>
        <Link href="/aviso-de-privacidad">Aviso de privacidad</Link>
      </nav>
    </main>
  );
}
