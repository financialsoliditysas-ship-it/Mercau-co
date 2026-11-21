import UpdateBusinessForm from "@/components/UpdateBusinessForm";

export default async function UpdateBusinessPage(
  props: {
    params: Promise<{ token: string }>;
  }
) {
  const params = await props.params;
  return <UpdateBusinessForm token={params.token} />;
}
