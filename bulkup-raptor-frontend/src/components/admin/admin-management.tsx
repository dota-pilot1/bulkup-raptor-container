"use client";

import Link from "next/link";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAdminMembers,
  updateMemberStatus,
  currentMember,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { RbacManagement } from "@/components/admin/rbac-management";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { MemberRoleControl } from "@/components/admin/member-role-control";
import { canAccessAdmin, accessibleAdminMenus, canManageAdminResource, type AdminTab } from "@/entities/session";


const formatDate = (isoString: string) => {
  try {
    const d = new Date(isoString);
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
};

export function AdminManagement({ initialTab }: { initialTab: Exclude<AdminTab, "products"> }) {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["me"], queryFn: currentMember, refetchInterval: 15_000, refetchOnWindowFocus: true });
  const menus = accessibleAdminMenus(session.data);
  const canManageMembers = canManageAdminResource(session.data, "MEMBER_MANAGE");
  const canAssignRoles = canManageAdminResource(session.data, "MEMBER_ROLE_ASSIGN");
  const activeTab = initialTab;
  const selectedTab = menus.some((menu) => menu.id === activeTab) ? activeTab : menus[0]?.id;
  const canManageRbac = canManageAdminResource(session.data,
    selectedTab === "roles" ? "ROLE_MANAGE" : "PERMISSION_MANAGE");

  const canEditSelectedTab = selectedTab === "members" ? canManageMembers || canAssignRoles : canManageRbac;

  // ================= Member State =================
  const [memberSearch, setMemberSearch] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState<string>("ALL");
  const [appliedMemberFilters, setAppliedMemberFilters] = useState({ search: "", status: "ALL" });
  const [memberPage, setMemberPage] = useState(0);
  const [memberPageSize, setMemberPageSize] = useState(10);
  const membersQuery = useQuery({
    queryKey: ["admin-members", memberPage, memberPageSize, appliedMemberFilters.search, appliedMemberFilters.status],
    placeholderData: keepPreviousData,
    queryFn: () => listAdminMembers({ page: memberPage, size: memberPageSize, search: appliedMemberFilters.search, status: appliedMemberFilters.status }),
    enabled: selectedTab === "members",
  });
  const [memberMessage, setMemberMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // ================= Mutations =================
  const changeMemberStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "ACTIVE" | "PENDING" | "SUSPENDED" }) =>
      updateMemberStatus(id, status),
    onSuccess: async (_, variables) => {
      setMemberMessage({
        text: `회원 상태를 '${variables.status}'(으)로 변경했습니다.`,
      });
      setMemberPage(0);
      await queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (error) => {
      setMemberMessage({
        text: error instanceof Error ? error.message : "회원 상태 변경에 실패했습니다.",
        isError: true,
      });
    },
  });

  const filteredMembers = membersQuery.data?.content ?? [];
  const memberStats = membersQuery.data?.statistics ?? { total: 0, active: 0, pending: 0, suspended: 0 };
  const currentMemberPage = membersQuery.data?.page ?? memberPage;

  if (session.isPending) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-zinc-500">계정 확인 중입니다.</main>;
  }

  if (!canAccessAdmin(session.data)) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-bold text-zinc-950">관리 권한이 필요해요</h1>
        <p className="mt-2 text-sm text-zinc-500">관리자 페이지 접근 권한이 없습니다. MENU_ADMIN_ACCESS 권한을 확인해 주세요.</p>
        <Link href="/" className="mt-6 inline-flex h-9 items-center rounded-lg bg-zinc-950 px-3.5 text-xs font-bold text-white">상점으로 돌아가기</Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-start">
        <AdminNavigation activeTab={initialTab} memberCount={membersQuery.data?.statistics.total} />
        <div className="min-w-0 flex-1">
          {!canEditSelectedTab && <p role="status" className="mb-4 rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-600">조회 전용입니다. 등록·수정·삭제에는 별도 기능 권한이 필요합니다.</p>}

      {(selectedTab === "roles" || selectedTab === "permissions") && <RbacManagement key={`${selectedTab}:${canManageRbac}`} kind={selectedTab} canManage={canManageRbac} />}
      {/* TAB 2: MEMBER MANAGEMENT */}
      {selectedTab === "members" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs">
              <p className="text-xs font-bold text-zinc-500">총 회원</p>
              <p className="mt-2 text-2xl font-black text-zinc-900">{memberStats.total}명</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-xs">
              <p className="text-xs font-bold text-emerald-800">정상 활동 (ACTIVE)</p>
              <p className="mt-2 text-2xl font-black text-emerald-700">{memberStats.active}명</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5 shadow-xs">
              <p className="text-xs font-bold text-amber-800">인증 대기 (PENDING)</p>
              <p className="mt-2 text-2xl font-black text-amber-700">{memberStats.pending}명</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-5 shadow-xs">
              <p className="text-xs font-bold text-rose-700">이용 정지 (SUSPENDED)</p>
              <p className="mt-2 text-2xl font-black text-rose-700">{memberStats.suspended}명</p>
            </div>
          </div>

          {memberMessage && (
            <div
              className={`rounded-2xl p-4 text-xs font-semibold ${
                memberMessage.isError
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
              }`}
            >
              {memberMessage.text}
            </div>
          )}

          {/* Member Search & Filters */}
          <SearchFilterBar
            label="회원 이름 또는 이메일 검색"
            placeholder="회원 이름 또는 이메일 검색"
            value={memberSearch}
            onValueChange={setMemberSearch}
            busy={membersQuery.isFetching}
            isDirty={memberSearch.trim() !== appliedMemberFilters.search || memberStatusFilter !== appliedMemberFilters.status}
            onSearch={() => {
              const search = memberSearch.trim();
              if (memberPage === 0 && search === appliedMemberFilters.search && memberStatusFilter === appliedMemberFilters.status) {
                void membersQuery.refetch();
              }
              setAppliedMemberFilters({ search, status: memberStatusFilter });
              setMemberPage(0);
            }}
            onReset={() => {
              setMemberSearch("");
              setMemberStatusFilter("ALL");
              setAppliedMemberFilters({ search: "", status: "ALL" });
              setMemberPage(0);
            }}
          >
            <div className="w-full shrink-0 lg:w-48">
              <Select
                value={memberStatusFilter}
                onChange={setMemberStatusFilter}
                aria-label="회원 상태 필터"
                options={[
                  { value: "ALL", label: "전체 상태" },
                  { value: "ACTIVE", label: "정상 (ACTIVE)" },
                  { value: "PENDING", label: "대기 (PENDING)" },
                  { value: "SUSPENDED", label: "정지 (SUSPENDED)" },
                ]}
              />
            </div>
          </SearchFilterBar>

          <div className="flex items-center justify-end gap-3">
            <span className="text-sm text-zinc-500">페이지당 회원 수</span>
            <div className="w-28">
              <Select aria-label="페이지당 회원 수" value={String(memberPageSize)}
                onChange={(value) => { setMemberPageSize(Number(value)); setMemberPage(0); }}
                options={[10, 20, 50].map((size) => ({ value: String(size), label: `${size}명` }))} />
            </div>
          </div>

          {/* Member Table */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xs">
            {(membersQuery.isPending || membersQuery.isPlaceholderData) && (
              <div className="p-12 text-center text-sm font-medium text-zinc-500">
                회원 목록을 불러오는 중입니다...
              </div>
            )}

            {membersQuery.isError && (
              <div className="p-8 text-center text-sm font-medium text-rose-700 bg-rose-50">
                회원 정보를 불러오지 못했습니다. 백엔드 연결 상태를 확인해 주세요.
              </div>
            )}

            {membersQuery.data && !membersQuery.isPlaceholderData && filteredMembers.length === 0 && (
              <div className="p-12 text-center text-sm font-medium text-zinc-500">
                조건에 일치하는 회원이 없습니다.
              </div>
            )}

            {membersQuery.data && !membersQuery.isPlaceholderData && filteredMembers.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm text-zinc-600">
                  <thead className="whitespace-nowrap border-b border-zinc-200 bg-zinc-50/80 text-xs font-bold text-zinc-700">
                    <tr>
                      <th className="px-5 py-3.5">회원 ID</th>
                      <th className="px-5 py-3.5">이름 / 이메일</th>
                      <th className="px-5 py-3.5">계정 상태</th>
                      <th className="px-5 py-3.5">역할</th>
                      <th className="px-5 py-3.5">이메일 인증</th>
                      <th className="px-5 py-3.5">가입 일시</th>
                      <th className="px-5 py-3.5 text-right">상태 변경 관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-zinc-50/70 transition">
                        <td className="px-5 py-4 font-mono text-xs font-semibold text-zinc-400">
                          #{member.id}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-zinc-900">{member.name}</p>
                          <p className="font-mono text-xs text-zinc-500">{member.email}</p>
                        </td>
                        <td className="px-5 py-4">
                          {member.status === "ACTIVE" && (
                            <Badge variant="success">정상 (ACTIVE)</Badge>
                          )}
                          {member.status === "PENDING" && (
                            <Badge variant="warning">대기 (PENDING)</Badge>
                          )}
                          {member.status === "SUSPENDED" && (
                            <Badge variant="danger">정지 (SUSPENDED)</Badge>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {canAssignRoles ? <MemberRoleControl member={member} actorId={session.data!.id} /> : <span className="text-sm text-zinc-600">{member.roles.map((role) => role.name).join(", ")}</span>}
                        </td>
                        <td className="px-5 py-4">
                          {member.emailVerified ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              인증완료
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-400">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              미인증
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-zinc-500 whitespace-nowrap">
                          {formatDate(member.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {member.status !== "ACTIVE" && (
                              <button
                                type="button"
                                disabled={!canManageMembers || changeMemberStatusMutation.isPending}
                                onClick={() =>
                                  changeMemberStatusMutation.mutate({ id: member.id, status: "ACTIVE" })
                                }
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition"
                              >
                                정상 승인
                              </button>
                            )}
                            {member.status !== "SUSPENDED" && (
                              <button
                                type="button"
                                disabled={!canManageMembers || changeMemberStatusMutation.isPending}
                                onClick={() => {
                                  if (confirm(`${member.name} (${member.email}) 회원을 이용 정지 처리할까요?`)) {
                                    changeMemberStatusMutation.mutate({ id: member.id, status: "SUSPENDED" });
                                  }
                                }}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                              >
                                이용 정지
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {membersQuery.data && !membersQuery.isPlaceholderData && (
              <nav aria-label="회원 목록 페이지 이동" className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4 text-sm">
                <p aria-live="polite" className="text-zinc-500">
                  검색 결과 {membersQuery.data.totalElements}명
                  {membersQuery.data.totalElements > 0 && ` · ${currentMemberPage * memberPageSize + 1}–${currentMemberPage * memberPageSize + filteredMembers.length}명 표시`}
                </p>
                <div className="flex items-center gap-3">
                  <button type="button" disabled={currentMemberPage === 0 || membersQuery.isFetching}
                    onClick={() => setMemberPage(currentMemberPage - 1)}
                    className="rounded-lg border px-3 py-2 disabled:opacity-40">이전</button>
                  <span>{membersQuery.data.totalPages === 0 ? 0 : currentMemberPage + 1} / {membersQuery.data.totalPages} 페이지</span>
                  <button type="button" disabled={currentMemberPage + 1 >= membersQuery.data.totalPages || membersQuery.isFetching}
                    onClick={() => setMemberPage(currentMemberPage + 1)}
                    className="rounded-lg border px-3 py-2 disabled:opacity-40">다음</button>
                </div>
              </nav>
            )}
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
