"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rbacApi, type PermissionCategory } from "@/lib/api";
import { Dialog } from "@/components/ui/dialog";

const button = "rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40";
const input = "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-emerald-600 outline-none";
type CategoryForm = { id: number | null; code: string; name: string; description: string; sortOrder: number };

export function PermissionCategoryManagement({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const categories = useQuery({ queryKey: ["permission-categories"], queryFn: rbacApi.categories });
  const [form, setForm] = useState<CategoryForm | null>(null);
  const [deleting, setDeleting] = useState<PermissionCategory | null>(null);
  const [notice, setNotice] = useState("");
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: ["permission-categories"] }),
    client.invalidateQueries({ queryKey: ["rbac-permissions"] }),
    client.invalidateQueries({ queryKey: ["rbac-roles"] }),
  ]);
  const save = useMutation({
    mutationFn: (value: CategoryForm) => value.id === null
      ? rbacApi.createCategory({ code: value.code, name: value.name.trim(), description: value.description.trim(), sortOrder: value.sortOrder })
      : rbacApi.updateCategory(value.id, { name: value.name.trim(), description: value.description.trim(), sortOrder: value.sortOrder }),
    onSuccess: async () => { setForm(null); setNotice("카테고리를 저장했습니다."); await refresh(); },
  });
  const remove = useMutation({
    mutationFn: rbacApi.deleteCategory,
    onSuccess: async () => { setDeleting(null); setNotice("카테고리를 삭제했습니다."); await refresh(); },
  });
  const pending = save.isPending || remove.isPending;
  const close = () => { if (pending) return; if (form) setForm(null); else if (deleting) setDeleting(null); else onClose(); };
  return <Dialog isOpen onClose={close} closeDisabled={pending} title={form ? `카테고리 ${form.id === null ? "추가" : "수정"}` : deleting ? "카테고리 삭제" : "권한 카테고리 관리"} maxWidthClassName="max-w-2xl">
    {form ? <form className="space-y-4" onSubmit={(event: FormEvent) => { event.preventDefault(); save.mutate(form); }}>
      <label className="block space-y-1 text-sm"><span>코드</span><input className={input} value={form.code} disabled={form.id !== null || pending} required maxLength={64} pattern="[A-Z][A-Z0-9_]{1,63}" title="영문 대문자로 시작하고 대문자·숫자·밑줄을 사용합니다." onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /><span className="text-xs text-zinc-500">생성 후 변경할 수 없습니다.</span></label>
      <label className="block space-y-1 text-sm"><span>이름</span><input className={input} required maxLength={80} value={form.name} disabled={pending} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label className="block space-y-1 text-sm"><span>설명</span><textarea className={input} maxLength={500} rows={2} value={form.description} disabled={pending} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
      <label className="block space-y-1 text-sm"><span>표시 순서</span><input type="number" className={input} required min={0} max={2147483647} step={1} value={form.sortOrder} disabled={pending} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /><span className="text-xs text-zinc-500">작은 숫자부터 표시합니다.</span></label>
      {save.error && <p role="alert" className="text-sm text-rose-700">{save.error.message}</p>}
      <div className="flex justify-end gap-2"><button type="button" className={button} disabled={pending} onClick={() => setForm(null)}>취소</button><button className="rounded-lg bg-zinc-950 px-4 py-2 text-sm text-white disabled:opacity-40" disabled={pending}>{pending ? "저장 중..." : "저장"}</button></div>
    </form> : deleting ? <div className="space-y-4">
      <p className="text-sm">{deleting.name} 카테고리를 삭제할까요?</p>
      {remove.error && <p role="alert" className="text-sm text-rose-700">{remove.error.message}</p>}
      <div className="flex justify-end gap-2"><button className={button} disabled={pending} onClick={() => setDeleting(null)}>취소</button><button className={`${button} text-rose-700`} disabled={pending} onClick={() => remove.mutate(deleting.id)}>삭제</button></div>
    </div> : <div className="space-y-4">
      <p className="text-sm text-zinc-500">권한을 업무별로 분류합니다. 권한이 연결된 카테고리는 먼저 권한을 옮긴 뒤 삭제합니다.</p>
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
      <div className="flex justify-end"><button className={button} onClick={() => { save.reset(); setForm({ id: null, code: "", name: "", description: "", sortOrder: (categories.data?.at(-1)?.sortOrder ?? 0) + 10 }); }}>카테고리 추가</button></div>
      <div className="max-h-[55vh] overflow-auto rounded-lg border border-zinc-200">
        {categories.isPending ? <p className="p-4 text-sm">불러오는 중입니다.</p> : categories.isError ? <p role="alert" className="p-4 text-sm text-rose-700">{categories.error.message}</p> : <table className="w-full text-left text-sm"><thead className="bg-zinc-50 text-xs"><tr><th className="p-3">이름 / 코드</th><th className="p-3">순서</th><th className="p-3">권한 수</th><th className="p-3 text-right">관리</th></tr></thead><tbody className="divide-y divide-zinc-100">
          {categories.data?.map((category) => <tr key={category.id}><td className="p-3"><p className="font-semibold">{category.name}</p><p className="mt-1 font-mono text-xs text-zinc-500">{category.code}</p>{category.description && <p className="mt-1 text-xs text-zinc-500">{category.description}</p>}</td><td className="p-3">{category.sortOrder}</td><td className="p-3">{category.permissionCount}개</td><td className="p-3"><div className="flex justify-end gap-2"><button className={button} onClick={() => { save.reset(); setForm(category); }}>수정</button><button className={`${button} text-rose-700`} disabled={category.permissionCount > 0} title={category.permissionCount > 0 ? "권한을 다른 카테고리로 옮긴 뒤 삭제해 주세요." : undefined} onClick={() => { remove.reset(); setDeleting(category); }}>삭제</button></div></td></tr>)}
          {categories.data?.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-zinc-500">카테고리를 추가해 주세요.</td></tr>}
        </tbody></table>}
      </div>
      <div className="flex justify-end"><button className={button} onClick={onClose}>닫기</button></div>
    </div>}
  </Dialog>;
}
