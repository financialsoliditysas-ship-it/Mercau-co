import { notFound } from 'next/navigation';
import BuyerExperience from '@/components/buyer/BuyerExperience';
export default async function Page(
  props:{params: Promise<{section?:string[]}>;searchParams: Promise<{tipo?:string}>}
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const section=params.section?.join('/') || 'inicio';
  if(!['inicio','restaurantes','comercios','explorar','favoritos','pedidos','cuenta'].includes(section)) notFound();
  return <BuyerExperience section={section} quickFilter={searchParams.tipo || ''}/>;
}
