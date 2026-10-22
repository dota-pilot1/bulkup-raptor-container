import { Header } from "@/widgets/header/ui/header";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header fullWidth />
      {children}
    </>
  );
}
