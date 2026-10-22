"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rbacApi, type RbacRole, type RbacPermission } from "@/lib/api";
import { PermissionCategoryManagement } from "./permission-category-management";
import { Dialog } from "@/components/ui/dialog";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";

import { fixedPermissions, permissionRestriction } from "./permission-policy";
import { PermissionSettingsDialog } from "./permission-settings-dialog";
const button = "rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40";
const input = "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-600";
type Form = { id: number | null; code: string; name: string; description: string; permissionIds: number[]; categoryId?: number };

export function RbacManagement({ kind, canManage }: { kind: "roles" | "permissions"; canManage: boolean }) {
  const queryClient = useQueryClient();
  const roleMode = kind === "roles";
  const label = roleMode ? "역할" : "권한";
  const roles = useQuery({ queryKey: ["rbac-roles"], queryFn: rbacApi.roles, enabled: roleMode });
  const permissions = useQuery({ queryKey: ["rbac-permissions"], queryFn: () => rbacApi.permissions() });
  const categories = useQuery({ queryKey: ["permission-categories"], queryFn: rbacApi.categories });
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [deleting, setDeleting] = useState<RbacRole | RbacPermission | null>(null);
  const [linkForm, setLinkForm] = useState<{ role: RbacRole; ids: number[] } | null>(null);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["rbac-roles"] }),
      queryClient.invalidateQueries({ queryKey: ["rbac-permissions"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-members"] }),
      queryClient.invalidateQueries({ queryKey: ["permission-categories"] }),
    ]);
  };
  const save = useMutation({
    mutationFn: async (value: Form) => {
      const data = { code: value.code, name: value.name.trim(), description: value.description.trim() };
      if (roleMode) {
        if (value.id === null) await rbacApi.createRole({ ...data, permissionIds: value.permissionIds });
        else await rbacApi.updateRole(value.id, data);
      } else {
        if (value.id === null) await rbacApi.createPermission({ ...data, categoryId: value.categoryId! });
        else await rbacApi.updatePermission(value.id, { ...data, categoryId: value.categoryId! });
      }
    },
    onSuccess: async () => { setForm(null); await refresh(); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => roleMode ? rbacApi.deleteRole(id) : rbacApi.deletePermission(id),
    onSuccess: async () => { setDeleting(null); await refresh(); },
  });
  const links = useMutation({
    mutationFn: (value: { id: number; ids: number[] }) => rbacApi.setPermissions(value.id, value.ids),
    onSuccess: async () => { setNotice("권한을 저장했습니다. 해당 역할의 회원은 다시 로그인하면 변경된 권한을 사용합니다."); setLinkForm(null); await refresh(); },
  });
  const permissionChoices = (selected: number[], change: (ids: number[]) => void, role?: RbacRole) => (
    <div className="mt-4 space-y-3">
      {permissions.isPending && <p className="text-sm text-zinc-500">권한 목록을 불러오는 중입니다.</p>}
      {permissions.isError && <p role="alert" className="text-sm text-rose-700">권한 목록을 불러오지 못했습니다.</p>}
      {categories.isError && <p role="alert" className="text-sm text-rose-700">카테고리를 불러오지 못했습니다.</p>}
      {(categories.data ?? []).map((category) => {
        const choices = permissions.data?.filter((p) => p.categoryId === category.id) ?? [];
        if (!choices.length) return null;
        return <fieldset key={category.id} className="space-y-2 rounded-lg border border-zinc-200 p-3">
          <legend className="px-1 text-sm font-semibold">{category.name} <span className="text-xs font-normal text-zinc-400">{choices.filter((p) => selected.includes(p.id)).length}/{choices.length}</span></legend>
          {choices.map((p) => <label key={p.id} className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={selected.includes(p.id)} disabled={links.isPending || save.isPending || Boolean(permissionRestriction(p, role))}
              onChange={(e) => change(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))} className="mt-1 accent-emerald-700" />
            <span>{p.name} <span className="text-xs text-zinc-500">{p.code}{permissionRestriction(p, role) ? ` · ${permissionRestriction(p, role)}` : ""}</span></span>
          </label>)}
        </fieldset>;
      })}
    </div>
  );
  const selectedQuery = roleMode ? roles : permissions;
  const effectiveCategory = categories.data?.some((c) => c.id === categoryId) ? categoryId : null;
  const query = appliedSearch.toLocaleLowerCase();
  const items = roleMode ? roles.data : permissions.data?.filter((p) =>
    (effectiveCategory === null || p.categoryId === effectiveCategory) &&
    (!query || p.name.toLocaleLowerCase().includes(query) || p.code.toLocaleLowerCase().includes(query)));
  const totalPermissions = permissions.data?.length ?? 0;
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-xl font-bold">{label} 관리</h1><p className="mt-1 text-sm text-zinc-500">
          {roleMode ? "역할별 메뉴 접근 권한과 기능 실행 권한을 지정합니다." : "메뉴 접근과 기능 실행 권한을 별도 카테고리로 관리합니다. 새 권한은 사용 지점에 검사를 연결해야 적용됩니다."}
        </p></div>
        <div className="flex shrink-0 gap-2">{!roleMode && canManage && <button type="button" className={button} onClick={() => setCategoryOpen(true)}>카테고리 관리</button>}<button type="button" disabled={!canManage} className="shrink-0 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white"
          onClick={() => { save.reset(); setForm({ id: null, code: "", name: "", description: "", permissionIds: [], categoryId: effectiveCategory ?? categories.data?.[0]?.id }); }}>{label} 추가</button></div>
      </div>
      {!roleMode && <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="권한 카테고리">
          {categories.data?.map((category) => <button key={category.id} type="button" aria-pressed={effectiveCategory === category.id} className={`${button} ${effectiveCategory === category.id ? "bg-zinc-950 text-white" : "bg-white"}`} onClick={() => setCategoryId(category.id)}>{category.name} {category.permissionCount}</button>)}
          <button type="button" aria-pressed={effectiveCategory === null} className={`${button} ${effectiveCategory === null ? "bg-zinc-950 text-white" : "bg-white"}`} onClick={() => setCategoryId(null)}>전체 {totalPermissions}</button>
        </div>
        <div className="w-full lg:ml-auto lg:w-[520px] lg:shrink-0">
          <SearchFilterBar
            variant="inline"
            label="권한 이름 또는 코드 검색"
            placeholder="권한 이름 또는 코드 검색"
            value={search}
            onValueChange={setSearch}
            onSearch={() => setAppliedSearch(search.trim())}
            onReset={() => { setSearch(""); setAppliedSearch(""); setCategoryId(null); }}
            isDirty={search.trim() !== appliedSearch}
          />
        </div>
        {categories.isError && <p role="alert" className="w-full text-sm text-rose-700">{categories.error.message}</p>}
      </div>}
      {categoryOpen && canManage && <PermissionCategoryManagement onClose={() => setCategoryOpen(false)} />}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        {selectedQuery.isPending ? <p className="p-6 text-sm">불러오는 중입니다.</p> : selectedQuery.isError ? <p role="alert" className="p-6 text-sm text-rose-700">{selectedQuery.error.message}</p> : (
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs"><tr>
              <th className="p-4">코드 / 이름</th>{!roleMode && <th className="p-4">카테고리</th>}<th className="p-4">설명</th><th className="p-4">{roleMode ? "허용 기능" : "연결 역할 수"}</th><th className="p-4">구분</th><th className="p-4 text-right">관리</th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {items?.map((item) => {
                const isRole = "systemRole" in item;
                const protectedItem = isRole ? item.systemRole : item.systemPermission;
                const inUse = isRole ? item.memberCount > 0 : item.roleCount > 0;
                return <tr key={item.id} className="align-top">
                  <td className="p-4"><p className="font-semibold">{item.name}</p><p className="mt-1 font-mono text-xs text-zinc-500">{item.code}</p>{isRole && <p className="mt-1 text-xs text-zinc-500">회원 {item.memberCount}명</p>}</td>
                  {!isRole && <td className="whitespace-nowrap p-4 text-xs text-zinc-600">{item.categoryName}</td>}
                  <td className="max-w-xs p-4 text-zinc-600">{item.description || "—"}</td>
                  <td className="max-w-md p-4">{isRole ? <div className="flex flex-wrap gap-1">{item.permissions.length ? item.permissions.map((p) => <span key={p.id} className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800">{p.name}</span>) : "없음"}</div> : <div><p>{item.roleCount}개</p><p className="mt-1 text-xs text-zinc-500">{item.roles.map((role) => role.name).join(", ")}</p></div>}</td>
                  <td className="whitespace-nowrap p-4 text-xs text-zinc-500">{protectedItem ? "기본" : "사용자 정의"}</td>
                  <td className="whitespace-nowrap p-4 text-right"><div className="flex justify-end gap-2">
                    <button type="button" disabled={!canManage} className={button} onClick={() => { save.reset(); setForm({ id: item.id, code: item.code, name: item.name, description: item.description, permissionIds: [], categoryId: isRole ? undefined : item.categoryId }); }}>수정</button>
                    {isRole && <button type="button" className={button} title={!canManage ? "조회 전용입니다." : fixedPermissions(item) ? "이 역할의 권한은 고정됩니다." : "메뉴 접근과 기능 권한을 선택합니다."} onClick={() => { links.reset(); setLinkForm({ role: item, ids: item.permissions.map((p) => p.id) }); }}>{!canManage || fixedPermissions(item) ? "권한 보기" : "권한 설정"}</button>}
                    <button type="button" className={`${button} text-rose-700`} disabled={!canManage || protectedItem || inUse} title={protectedItem ? "기본 항목은 삭제할 수 없습니다." : inUse ? "연결을 먼저 해제해 주세요." : undefined} onClick={() => { remove.reset(); setDeleting(item); }}>삭제</button>
                  </div></td>
                </tr>;
              })}
              {items?.length === 0 && <tr><td colSpan={roleMode ? 5 : 6} className="p-8 text-center text-zinc-500">등록된 {label}이 없습니다.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      <Dialog isOpen={canManage && form !== null} onClose={() => { if (!save.isPending) setForm(null); }} closeDisabled={save.isPending} title={`${label} ${form?.id === null ? "추가" : "수정"}`} maxWidthClassName="max-w-xl">
        {form && <form className="max-h-[70vh] space-y-4 overflow-y-auto" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(form); }}>
          <label className="block space-y-1 text-sm"><span>코드</span><input className={input} value={form.code} disabled={form.id !== null} required maxLength={64} pattern="(?!ROLE_)[A-Z][A-Z0-9_]{1,63}" title="영문 대문자·숫자·밑줄을 사용합니다. ROLE_로 시작할 수 없습니다." onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /><span className="block text-xs text-zinc-500">생성 후 변경할 수 없습니다.</span></label>
          <label className="block space-y-1 text-sm"><span>이름</span><input className={input} required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="block space-y-1 text-sm"><span>설명</span><textarea className={input} maxLength={500} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          {!roleMode && <label className="block space-y-1 text-sm"><span>카테고리</span><select className={input} required disabled={save.isPending || categories.isPending || categories.isError} value={form.categoryId ?? ""} onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}><option value="" disabled>카테고리 선택</option>{categories.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{categories.isError && <span role="alert" className="block text-xs text-rose-700">카테고리를 불러오지 못했습니다.</span>}{categories.data?.length === 0 && <span className="block text-xs text-zinc-500">카테고리 관리에서 카테고리를 먼저 추가해 주세요.</span>}</label>}
          {roleMode && form.id === null && permissionChoices(form.permissionIds, (ids) => setForm({ ...form, permissionIds: ids }))}
          {save.error && <p role="alert" className="text-sm text-rose-700">{save.error.message}</p>}
          <div className="flex justify-end gap-2"><button type="button" className={button} disabled={save.isPending} onClick={() => setForm(null)}>취소</button><button type="submit" disabled={save.isPending || (roleMode && form.id === null && (!permissions.data || !categories.data)) || (!roleMode && (!form.categoryId || !categories.data))} className="rounded-lg bg-zinc-950 px-4 py-2 text-sm text-white disabled:opacity-40">{save.isPending ? "저장 중..." : "저장"}</button></div>
        </form>}
      </Dialog>
      {linkForm && <PermissionSettingsDialog
        key={linkForm.role.id}
        role={linkForm.role}
        readOnly={!canManage}
        selected={linkForm.ids}
        onChange={(ids) => setLinkForm({ ...linkForm, ids })}
        onClose={() => { if (!links.isPending) setLinkForm(null); }}
        onSave={() => links.mutate({ id: linkForm.role.id, ids: linkForm.ids })}
        saving={links.isPending}
        error={links.error}
      />}
      <Dialog isOpen={deleting !== null} onClose={() => { if (!remove.isPending) setDeleting(null); }} closeDisabled={remove.isPending} title={`${label} 삭제`}>
        <p className="text-sm">{deleting?.name} 항목을 삭제할까요?</p>
        {remove.error && <p role="alert" className="mt-3 text-sm text-rose-700">{remove.error.message}</p>}
        <div className="mt-5 flex justify-end gap-2"><button className={button} disabled={remove.isPending} onClick={() => setDeleting(null)}>취소</button><button disabled={remove.isPending || !deleting} onClick={() => deleting && remove.mutate(deleting.id)} className="rounded-lg bg-rose-700 px-4 py-2 text-sm text-white disabled:opacity-40">{remove.isPending ? "삭제 중..." : "삭제"}</button></div>
      </Dialog>
    </section>
  );
}
