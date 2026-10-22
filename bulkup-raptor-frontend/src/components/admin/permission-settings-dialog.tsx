"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { rbacApi, type RbacRole } from "@/lib/api";
import { Dialog } from "@/components/ui/dialog";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { fixedPermissions, permissionRestriction } from "./permission-policy";

type Props = {
  role: RbacRole;
  readOnly?: boolean;
  selected: number[];
  onChange: (ids: number[]) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  error?: Error | null;
};

const tabButton = "rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold transition disabled:opacity-40";

export function PermissionSettingsDialog({ role, readOnly: viewOnly = false, selected, onChange, onSave, onClose, saving, error }: Props) {
  const permissions = useQuery({ queryKey: ["rbac-permissions"], queryFn: () => rbacApi.permissions() });
  const categories = useQuery({ queryKey: ["permission-categories"], queryFn: rbacApi.categories });
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const readOnly = viewOnly || fixedPermissions(role);
  const added = selected.filter((id) => !role.permissions.some((p) => p.id === id)).length;
  const removed = role.permissions.filter((p) => !selected.includes(p.id)).length;
  const activeCategory = categories.data?.some((c) => c.id === categoryId) ? categoryId : null;
  const query = appliedSearch.toLocaleLowerCase();
  const visible = permissions.data?.filter((p) =>
    (activeCategory === null || p.categoryId === activeCategory) &&
    (!query || p.name.toLocaleLowerCase().includes(query) || p.code.toLocaleLowerCase().includes(query))) ?? [];
  const busy = permissions.isPending || categories.isPending;
  const loadError = permissions.error || categories.error;

  return <Dialog isOpen fullScreen onClose={onClose} closeDisabled={saving}
    title={`${role.name} ${readOnly ? "권한 보기" : "권한 설정"}`}
    description={readOnly ? "조회 전용입니다. 설정된 메뉴 접근과 기능 권한을 확인할 수 있습니다." : `권한이 바뀌면 이 역할의 회원 ${role.memberCount}명은 다시 로그인해야 합니다.`}
    footer={<div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-zinc-600" role="status">선택 {selected.length}개{!readOnly && <span className="ml-3 text-zinc-500">추가 {added}개 · 해제 {removed}개</span>}</div>
      <div className="flex gap-2"><button type="button" disabled={saving} className={tabButton} onClick={onClose}>{readOnly ? "닫기" : "취소"}</button>
        {!readOnly && <button type="button" disabled={saving || busy || Boolean(loadError) || added + removed === 0} onClick={onSave} className="rounded-lg bg-zinc-950 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{saving ? "저장 중..." : "권한 저장"}</button>}
      </div>
    </div>}>
    <div className="shrink-0 space-y-3 border-b border-zinc-200 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="권한 설정 카테고리">
          {categories.data?.map((category) => <button key={category.id} type="button" aria-pressed={activeCategory === category.id} className={`${tabButton} ${activeCategory === category.id ? "bg-zinc-950 text-white" : "bg-white text-zinc-600"}`} onClick={() => setCategoryId(category.id)}>{category.name} {permissions.data?.filter((p) => p.categoryId === category.id && selected.includes(p.id)).length ?? 0}/{category.permissionCount}</button>)}
          <button type="button" aria-pressed={activeCategory === null} className={`${tabButton} ${activeCategory === null ? "bg-zinc-950 text-white" : "bg-white text-zinc-600"}`} onClick={() => setCategoryId(null)}>전체 {permissions.data?.length ?? 0}</button>
        </div>
        <div className="w-full lg:ml-auto lg:w-[520px] lg:shrink-0"><SearchFilterBar variant="inline" label="설정할 권한 이름 또는 코드 검색" placeholder="권한 이름 또는 코드 검색" value={search} onValueChange={setSearch} onSearch={() => setAppliedSearch(search.trim())} onReset={() => { setSearch(""); setAppliedSearch(""); setCategoryId(null); }} isDirty={search.trim() !== appliedSearch} /></div>
      </div>
      {role.code === "OPERATOR" && <p className="text-sm text-zinc-500">관리자 페이지 접근과 상품·주문·배송 기능 권한을 선택합니다. 회원·역할·권한 관리 기능 실행은 ADMIN만 사용할 수 있습니다.</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error.message}</p>}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 px-4 py-6 sm:px-6" aria-label="권한 선택 목록">
      {busy ? <p className="text-sm text-zinc-500">권한을 불러오는 중입니다.</p> : loadError ? <p role="alert" className="text-sm text-rose-700">{loadError.message}</p> : visible.length === 0 ? <p className="py-12 text-center text-sm text-zinc-500">조건에 맞는 권한이 없습니다.</p> : <div className="space-y-6">
        {categories.data?.map((category) => {
          const choices = visible.filter((p) => p.categoryId === category.id);
          if (!choices.length) return null;
          return <fieldset key={category.id}>
            <legend className="mb-3 text-sm font-bold text-zinc-900">{category.name} <span className="ml-1 font-normal text-zinc-400">{choices.length}개</span></legend>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {choices.map((permission) => {
                const restriction = readOnly ? "조회 전용" : permissionRestriction(permission, role);
                const checked = selected.includes(permission.id);
                return <label key={permission.id} className={`flex min-w-0 items-start gap-3 rounded-xl border bg-white p-4 ${checked ? "border-emerald-300" : "border-zinc-200"} ${restriction ? "cursor-default" : "cursor-pointer hover:border-emerald-400"}`}>
                  <input type="checkbox" checked={checked} disabled={saving || Boolean(restriction)} onChange={(event) => onChange(event.target.checked ? [...selected, permission.id] : selected.filter((id) => id !== permission.id))} className="mt-1 h-4 w-4 shrink-0 accent-emerald-700" />
                  <span className="min-w-0"><span className="block text-sm font-semibold text-zinc-900">{permission.name}</span><span className="mt-1 block break-all font-mono text-xs text-zinc-500">{permission.code}</span>{permission.description && <span className="mt-2 block text-sm text-zinc-500">{permission.description}</span>}{restriction && <span className="mt-2 block text-xs text-zinc-400">{restriction}</span>}</span>
                </label>;
              })}
            </div>
          </fieldset>;
        })}
      </div>}
    </div>
  </Dialog>;
}
