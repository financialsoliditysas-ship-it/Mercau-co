import CatalogManager from '@/components/CatalogManager';
export default async function CatalogManagerPage(props:{params: Promise<{businessId:string}>}) {
  const params = await props.params;
  return <CatalogManager businessId={params.businessId} />;
}
