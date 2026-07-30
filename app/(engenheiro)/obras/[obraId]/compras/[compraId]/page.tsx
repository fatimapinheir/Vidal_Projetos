import { CompraDetail } from "@/components/compras/compra-detail";

export default async function CompraDetalhePage({
  params,
}: {
  params: Promise<{ compraId: string }>;
}) {
  const { compraId } = await params;
  return <CompraDetail compraId={compraId} viewerRole="engenheiro" />;
}
