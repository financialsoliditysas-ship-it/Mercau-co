import Link from 'next/link';
import Image from 'next/image';
import { Poppins } from 'next/font/google';
import BusinessPlans from '@/components/BusinessPlans';
const poppins=Poppins({subsets:['latin'],weight:['400','600','700','800','900'],display:'swap'});
export const metadata={title:'Planes para negocios | Mercáu',description:'Planes de presencia, vitrina y ventas para comercios y restaurantes en Mercáu.'};
export default function EmpresasPage(){return <main className={`${poppins.className} min-h-screen bg-white`}><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><Link href="/" className="flex items-center gap-2 text-2xl font-black text-[#E21412]"><Image src="/logo-mercau.png" alt="Mercáu" width={40} height={40}/>Mercáu</Link><Link href="/negocios/registro" className="rounded-md bg-[#E21412] px-4 py-3 text-sm font-bold text-white">Registrar mi negocio</Link></div></header><BusinessPlans/></main>}
