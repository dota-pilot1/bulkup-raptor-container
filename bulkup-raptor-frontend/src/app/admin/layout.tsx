import { Header } from "@/widgets/header/ui/header";
import { AdminAccessGuard } from "@/components/admin/admin-access-guard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAccessGuard>
      <Header fullWidth />
      {children}
    </AdminAccessGuard>
  );
}
