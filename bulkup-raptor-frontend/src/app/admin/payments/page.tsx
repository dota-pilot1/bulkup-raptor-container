import { PaymentManagement } from "@/components/admin/payment-management";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const { search } = await searchParams;
  const initialSearch = (search ?? "").trim().slice(0, 100);
  return <PaymentManagement key={initialSearch} initialSearch={initialSearch} />;
}
