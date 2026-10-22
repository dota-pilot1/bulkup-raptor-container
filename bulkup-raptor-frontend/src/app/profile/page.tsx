"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { currentMember, logout, type MemberSession, type MemberPermission } from "@/lib/api";
import { Header } from "@/widgets/header/ui/header";

const statusLabel: Record<MemberSession["status"], string> = {
  ACTIVE: "활동 중",
  PENDING: "가입 대기",
  SUSPENDED: "이용 정지",
};

const statusStyle: Record<MemberSession["status"], string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  SUSPENDED: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const member = useQuery({ queryKey: ["me"], queryFn: currentMember, refetchOnWindowFocus: "always" });
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.setQueryData(["me"], null);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push("/");
    },
  });
  const account = member.data;
  const permissionDetails = new Map(account?.permissionDetails?.map((permission) => [permission.code, permission]));
  const permissions: MemberPermission[] = account ? [...new Set(account.permissions)].map((code) =>
    permissionDetails.get(code) ?? { code, name: code, description: "" }) : [];
  const categories = new Map<string, { code: string; name: string; sortOrder: number; permissions: MemberPermission[] }>();
  for (const permission of permissions) {
    const code = permission.categoryCode ?? "OTHER";
    let category = categories.get(code);
    if (!category) {
      category = { code, name: permission.categoryName ?? "기타", sortOrder: permission.categorySortOrder ?? Number.MAX_SAFE_INTEGER, permissions: [] };
      categories.set(code, category);
    }
    category.permissions.push(permission);
  }
  const permissionGroups = [...categories.values()].sort((a, b) =>
    a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:px-10 sm:py-14">
        <p className="text-xs font-semibold tracking-[0.16em] text-emerald-700">MY ACCOUNT</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">프로필</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500">내 계정 정보와 부여된 역할, 사용할 수 있는 기능을 확인하세요.</p>

        {member.isLoading ? (
          <div role="status" aria-label="프로필 불러오는 중" className="mt-8 grid animate-pulse gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="h-80 rounded-2xl border border-zinc-200 bg-white" />
            <div className="h-72 rounded-2xl border border-zinc-200 bg-white" />
            <span className="sr-only">프로필을 불러오고 있어요.</span>
          </div>
        ) : member.isError ? (
          <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="font-bold text-zinc-950">프로필을 불러오지 못했어요</h2>
            <p role="alert" className="mt-2 text-sm text-zinc-500">잠시 후 다시 시도해 주세요.</p>
            <button type="button" onClick={() => member.refetch()} className="mt-5 cursor-pointer rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold">다시 시도</button>
          </section>
        ) : account ? (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="order-2 min-w-0 space-y-6 lg:order-1">
              <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-7">
                <h2 className="text-base font-bold text-zinc-950">기본 정보</h2>
                <dl className="mt-4 divide-y divide-zinc-100">
                  <ProfileRow label="이름" value={account.name} />
                  <ProfileRow label="이메일" value={account.email} />
                </dl>
              </section>

              <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-7">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-zinc-950">내 역할</h2>
                  <CountBadge count={account.roles.length} />
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-500">계정에 부여된 역할이에요. 여러 역할을 함께 가질 수 있어요.</p>
                {account.roles.length ? (
                  <ul aria-label="부여된 역할" className="mt-5 flex flex-wrap gap-2">
                    {account.roles.map((role) => (
                      <li key={role.id} className="max-w-full break-words rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{role.name}</li>
                    ))}
                  </ul>
                ) : <p className="mt-5 text-sm text-zinc-500">아직 부여된 역할이 없어요.</p>}
              </section>

              <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-7">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-zinc-950">사용 가능한 기능</h2>
                  <CountBadge count={permissions.length} />
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-500">각 역할에 연결된 권한을 중복 없이 카테고리별로 모았어요.</p>
                {permissions.length ? (
                  <div className="mt-6 space-y-6">
                    {permissionGroups.map((category) => (
                      <section key={category.code} aria-label={`${category.name} 권한`}>
                        <div className="mb-3 flex items-center gap-2">
                          <h3 className="break-words text-sm font-bold text-zinc-700">{category.name}</h3>
                          <CountBadge count={category.permissions.length} />
                        </div>
                        <ul aria-label={`${category.name} 권한 목록`} className="grid gap-3 sm:grid-cols-2">
                          {category.permissions.map((permission) => (
                            <li key={permission.code} className="min-w-0 rounded-xl border border-zinc-100 bg-zinc-50/70 p-4">
                              <p className="break-words text-sm font-semibold text-zinc-900">{permission.name}</p>
                              {permission.description && <p className="mt-1.5 break-words text-xs leading-5 text-zinc-500">{permission.description}</p>}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl bg-zinc-50 px-4 py-5">
                    <p className="text-sm font-medium text-zinc-700">부여된 관리 권한이 없어요.</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">관리 기능이 필요하다면 관리자에게 문의해 주세요.</p>
                  </div>
                )}
                <p className="mt-5 border-t border-zinc-100 pt-4 text-xs leading-5 text-zinc-400">역할과 권한은 관리자가 설정합니다. 이 페이지에서는 확인만 할 수 있어요.</p>
              </section>
            </div>

            <aside aria-label="프로필 요약" className="order-1 min-w-0 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs lg:order-2 lg:sticky lg:top-6">
              <div className="flex items-center gap-4 lg:flex-col lg:items-start">
                <span aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-2xl font-black text-emerald-800">{Array.from(account.name)[0]}</span>
                <div className="min-w-0">
                  <p className="break-words text-xl font-bold text-zinc-950">{account.name}<span className="ml-1 text-sm font-normal text-zinc-400">님</span></p>
                  <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyle[account.status]}`}>
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                    {statusLabel[account.status]}
                  </span>
                </div>
              </div>
              <dl className="mt-6 border-y border-zinc-100 py-1">
                <ProfileRow label="역할" value={`${account.roles.length}개`} />
                <ProfileRow label="권한" value={`${permissions.length}개`} />
              </dl>
              <button type="button" onClick={() => signOut.mutate()} disabled={signOut.isPending} className="mt-6 inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-wait disabled:opacity-50">
                {signOut.isPending ? "로그아웃 중..." : "로그아웃"}
              </button>
              {signOut.isError && <p role="alert" className="mt-3 text-xs leading-5 text-rose-600">로그아웃하지 못했어요. 다시 시도해 주세요.</p>}
            </aside>
          </div>
        ) : (
          <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-zinc-950">로그인이 필요해요</h2>
            <p className="mt-2 text-sm text-zinc-500">프로필은 로그인한 회원만 볼 수 있어요.</p>
            <Link href="/login" className="mt-5 inline-flex h-10 items-center rounded-lg bg-zinc-950 px-4 text-sm font-bold text-white transition hover:bg-zinc-800">로그인</Link>
          </section>
        )}
      </main>
    </>
  );
}

function CountBadge({ count }: { count: number }) {
  return <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-500">{count}</span>;
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-4 py-3.5">
      <dt className="pt-0.5 text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-semibold text-zinc-900">{value}</dd>
    </div>
  );
}
