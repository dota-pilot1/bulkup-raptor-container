import { redirect } from "next/navigation";
import { AdminManagement } from "@/components/admin/admin-management";

export default async function AdminPage({ searchParams }: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  if (tab === "inventory") redirect("/admin/inventory");
  if (tab === "payments") redirect("/admin/payments");
  if (tab === "orders") redirect("/admin/orders");
  if (tab !== "members" && tab !== "roles" && tab !== "permissions") {
    redirect("/admin/products");
  }
  return <AdminManagement key={tab} initialTab={tab} />;
}
