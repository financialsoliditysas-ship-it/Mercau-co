import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex min-h-[70vh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-xl text-center">
        <p className="text-sm font-bold uppercase text-[#E21412]">Error 404</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
          Esta página no está disponible
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-600">
          El enlace puede haber cambiado o la página ya no existe. Puedes volver al inicio y seguir explorando Mercáu.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-md bg-[#E21412] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#bd100f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E21412]"
        >
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}
