import Link from "next/link";
import { adminMenuGroups, adminMenus, type AdminTab } from "@/entities/session";

type Props = { activeTab: AdminTab; productCount?: number; memberCount?: number };

export function AdminNavigation({ activeTab, productCount, memberCount }: Props) {
  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-52">
      <nav aria-label="관리 메뉴" className="flex gap-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-3 shadow-xs lg:block">
        {adminMenuGroups.map(group => (
          <section key={group.id} aria-labelledby={`admin-menu-${group.id}`}
            className="min-w-40 shrink-0 lg:min-w-0 lg:border-t lg:border-zinc-100 lg:pt-4 lg:mt-4 lg:first:mt-0 lg:first:border-0 lg:first:pt-0">
            <h2 id={`admin-menu-${group.id}`} className="px-3 pb-2 pt-1 text-xs font-semibold text-zinc-400">{group.label}</h2>
            <ul className="space-y-1">
              {adminMenus.filter(menu => menu.group === group.id).map(({ id, label, href }) => {
                const active = activeTab === id;
                const count = id === "products" ? productCount : id === "members" ? memberCount : undefined;
                return <li key={id}><Link href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${active ? "bg-zinc-950 font-bold text-white" : "font-medium text-zinc-600 hover:bg-zinc-100"}`}>
                  <span>{label}</span>
                  {count !== undefined && <span className={`text-xs ${active ? "text-zinc-300" : "text-zinc-400"}`}>{count}</span>}
                </Link></li>;
              })}
            </ul>
          </section>
        ))}
      </nav>
    </aside>
  );
}
