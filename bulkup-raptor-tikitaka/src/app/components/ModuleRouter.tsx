"use client";

import { useActiveModule } from "./FullstackShell";
import HospitalPlaybookModule from "../../widgets/hospital-playbook/HospitalPlaybookModule";
import SettingsModule from "./SettingsModule";
import BookmarksModule from "./BookmarksModule";
import SearchModule from "./SearchModule";

import { playbookModules } from "@/features/hospital-playbook/modules";

export function ModuleRouter({ children }: { children: React.ReactNode; tree?: unknown }) {
  const active = useActiveModule();
  if (active === "노트 홈") return <>{children}</>;
  if (active === "북마크") return <BookmarksModule />;
  if (active === "설정") return <SettingsModule />;
  if (active === "통합 검색") return <SearchModule />;
  const moduleConfig = playbookModules[active];
  if (moduleConfig) return <main className="flex min-h-0 min-w-0 flex-1"><HospitalPlaybookModule key={active} domain={moduleConfig.domain} title={moduleConfig.title} initialCategoryId={moduleConfig.initialCategoryId} initialTopicId={moduleConfig.initialTopicId} initialTopicTitle={moduleConfig.initialTopicTitle} /></main>;
  return <main className="flex min-h-0 min-w-0 flex-1"><section className="module-empty"><p className="eyebrow">PKT MODULE</p><h1>{active}</h1><p>선택한 모듈을 준비하고 있습니다.</p></section></main>;
}
