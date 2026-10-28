import { notFound } from 'next/navigation';
import BuyerExperience from '@/components/buyer/BuyerExperience';
export default function Page({params}:{params:{section?:string[]}}) {
  const section=params.section?.join('/') || 'inicio';
  if(!['inicio','restaurantes','comercios','explorar','favoritos','pedidos','cuenta'].includes(section)) notFound();
  return <BuyerExperience section={section}/>;
}
