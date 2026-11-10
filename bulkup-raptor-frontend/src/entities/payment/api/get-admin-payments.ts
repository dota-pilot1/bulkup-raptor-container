import { apiFetch } from "@/shared/api/client";

export type AdminPayment = {
  orderId: number;
  paymentId: string;
  totalAmount: number;
  currency: string;
  paymentMethod: string | null;
  status: "READY" | "PAID" | "RETIRED" | "CANCELLED";
  createdAt: string;
  paidAt: string | null;
  webhookVerifiedAt: string | null;
};

export type AdminPaymentPage = {
  content: AdminPayment[];
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
};

export type AdminPaymentFilters = {
  search: string;
  status: "ALL" | AdminPayment["status"];
  webhookVerified: "ALL" | "true" | "false";
};

export function getAdminPayments(params: AdminPaymentFilters & { page: number; size: number }) {
  const query = new URLSearchParams({ page: String(params.page), size: String(params.size), search: params.search });
  if (params.status !== "ALL") query.set("status", params.status);
  if (params.webhookVerified !== "ALL") query.set("webhookVerified", params.webhookVerified);
  return apiFetch<AdminPaymentPage>(`/api/admin/payments?${query}`);
}
