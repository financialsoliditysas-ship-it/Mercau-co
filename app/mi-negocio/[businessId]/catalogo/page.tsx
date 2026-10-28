import CatalogManager from '@/components/CatalogManager';
export default function CatalogManagerPage({params}:{params:{businessId:string}}) {
  return <CatalogManager businessId={params.businessId} />;
}
