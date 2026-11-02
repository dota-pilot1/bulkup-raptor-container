import { readPaymentRedirect } from "@/features/prepare-payment/model/payment-result";
import PaymentResultPage from "@/views/payment-result/ui/payment-result-page";

export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PaymentResultPage result={readPaymentRedirect(await searchParams)} />;
}
