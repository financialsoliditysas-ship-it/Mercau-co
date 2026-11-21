import CommerceOrderAction from '@/components/CommerceOrderAction';export const dynamic='force-dynamic';export default async function Page(props:{params: Promise<{token:string}>}) {
  const params = await props.params;
  return <CommerceOrderAction token={params.token}/>;
}
