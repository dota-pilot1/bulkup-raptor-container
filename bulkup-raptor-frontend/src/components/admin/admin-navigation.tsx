import Link from "next/link";
import { adminMenus, type AdminTab } from "@/entities/session";

type Props = { activeTab: AdminTab; productCount?: number; memberCount?: number };

export function AdminNavigation({ activeTab, productCount, memberCount }: Props) {
  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-44">
      <nav aria-label="관리 메뉴" className="flex gap-1 overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-xs lg:block">
        {adminMenus.map(({ id, label }) => {
          const active = activeTab === id;
          const count = id === "products" ? productCount : id === "members" ? memberCount : undefined;
          return <Link key={id} href={id === "products" ? "/admin/products" : `/admin?tab=${id}`}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm lg:mt-1 lg:first:mt-0 ${active ? "bg-zinc-950 font-bold text-white" : "font-medium text-zinc-600 hover:bg-zinc-100"}`}>
            <span>{label}</span>
            {count !== undefined && <span className={`text-xs ${active ? "text-zinc-300" : "text-zinc-400"}`}>{count}</span>}
          </Link>;
        })}
      </nav>
    </aside>
  );
}
