"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rbacApi, updateMemberRoles, type AdminMember } from "@/lib/api";
import { Dialog } from "@/components/ui/dialog";

export function MemberRoleControl({ member, actorId }: { member: AdminMember; actorId: number }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const roles = useQuery({ queryKey: ["rbac-roles"], queryFn: rbacApi.roles, enabled: open });
  const mutation = useMutation({
    mutationFn: (ids: number[]) => updateMemberRoles(member.id, ids),
    onSuccess: async () => {
      setOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-members"] }),
        queryClient.invalidateQueries({ queryKey: ["rbac-roles"] }),
      ]);
    },
  });
  const currentIds = member.roles.map((role) => role.id);
  const changed = selectedIds.length !== currentIds.length || selectedIds.some((id) => !currentIds.includes(id));
  const selectedRoles = roles.data?.filter((role) => selectedIds.includes(role.id)) ?? [];
  const permissions = Array.from(new Map(selectedRoles.flatMap((role) => role.permissions)
    .map((permission) => [permission.id, permission])).values());

  return (
    <>
      <div className="min-w-48">
        <div className="flex flex-wrap gap-1">
          {member.roles.map((role) => <span key={role.id} className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">{role.name}</span>)}
        </div>
        <button type="button" disabled={member.id === actorId}
          aria-label={`${member.name} 역할 변경`}
          onClick={() => { setSelectedIds(currentIds); mutation.reset(); setOpen(true); }}
          className="mt-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40">
          역할 변경
        </button>
        {member.id === actorId && <p className="mt-1 text-xs text-zinc-500">본인 역할 변경 불가</p>}
      </div>
      <Dialog isOpen={open} onClose={() => { if (!mutation.isPending) setOpen(false); }}
        closeDisabled={mutation.isPending} title="회원 역할 변경"
        description={`${member.name} (${member.email})`} maxWidthClassName="max-w-2xl"
        footer={<>
          <button type="button" disabled={mutation.isPending} onClick={() => setOpen(false)}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm disabled:opacity-50">취소</button>
          <button type="button" disabled={mutation.isPending || !roles.data || roles.isError || selectedIds.length === 0 || !changed}
            onClick={() => mutation.mutate(selectedIds)}
            className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {mutation.isPending ? "저장 중..." : "역할 저장"}
          </button>
        </>}
      >
        <p className="mb-2 text-sm text-zinc-600">현재 역할: {member.roles.map((role) => role.name).join(", ")}</p>
        <p className="mb-4 text-sm text-zinc-600">담당할 역할을 모두 선택하세요. 최소 한 개의 역할이 필요합니다.</p>
        {roles.isPending && <p role="status" className="text-sm text-zinc-500">역할을 불러오는 중입니다.</p>}
        {roles.isError && <div role="alert" className="text-sm text-rose-700">{roles.error.message}
          <button type="button" onClick={() => void roles.refetch()} className="ml-2 underline">다시 시도</button></div>}
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {roles.data?.map((role) => <label key={role.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3">
            <input type="checkbox" checked={selectedIds.includes(role.id)} disabled={mutation.isPending}
              onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, role.id] : ids.filter((id) => id !== role.id))}
              className="mt-1 size-4 accent-emerald-700" />
            <span><span className="block text-sm font-semibold">{role.name}</span>
              <span className="block text-xs text-zinc-500">{role.description || role.code}</span></span>
          </label>)}
        </div>
        <div className="mt-5 rounded-lg bg-zinc-50 p-3">
          <p className="text-sm font-semibold">변경 후 역할</p>
          <p className="mt-1 text-sm text-zinc-600">{selectedRoles.map((role) => role.name).join(", ") || "선택한 역할 없음"}</p>
          <p className="mt-3 text-sm font-semibold">적용 권한 {permissions.length}개</p>
          <p className="mt-1 text-xs leading-6 text-zinc-600">{permissions.map((permission) => permission.name).join(", ") || "개별 권한 없음"}</p>
        </div>
        {selectedRoles.some((role) => role.code === "ADMIN") && <p className="mt-3 text-sm font-semibold text-amber-800">관리자 역할에는 회원·역할·권한 관리 기능이 포함됩니다.</p>}
        <p className="mt-3 text-sm text-zinc-500">역할을 변경하면 해당 회원은 다시 로그인해야 합니다.</p>
        {selectedIds.length === 0 && <p className="mt-2 text-sm text-rose-700">역할을 한 개 이상 선택하세요.</p>}
        {mutation.error && <p role="alert" className="mt-3 text-sm text-rose-700">{mutation.error.message}</p>}
      </Dialog>
    </>
  );
}
