"use client";

import { useState } from "react";
import type { MemberSession } from "@/entities/session";
import { DefaultDeliverySettings } from "@/features/default-delivery";
import { ProfileImagePicker } from "@/features/profile-image";
import { LogoutButton } from "@/features/logout";
import { groupPermissions } from "../model/group-permissions";

const profileSections = [
  { id: "basic", label: "기본 정보", icon: "user" },
  { id: "delivery", label: "배송 정보", icon: "pin" },
  { id: "permissions", label: "역할·권한", icon: "shield" },
] as const;
type ProfileSection = typeof profileSections[number]["id"];

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

export function ProfileTabs({ account }: { account: MemberSession }) {
  const [section, setSection] = useState<ProfileSection>("basic");
  const { permissions, permissionGroups } = groupPermissions(account);

  return (
    <div className="mt-8 grid items-start gap-6 md:grid-cols-[200px_minmax(0,1fr)] lg:gap-8">
      <nav aria-label="내 정보 메뉴" className="flex gap-1 rounded-2xl border border-zinc-200 bg-white p-2 md:sticky md:top-24 md:flex-col">
        {profileSections.map(item => (
          <button
            key={item.id}
            type="button"
            aria-current={section === item.id ? "page" : undefined}
            aria-controls={`profile-${item.id}`}
            onClick={() => setSection(item.id)}
            className={`flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 md:justify-start ${section === item.id ? "bg-emerald-50 text-emerald-800" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"}`}
          >
            <MenuIcon kind={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="min-w-0">
        <div id="profile-basic" hidden={section !== "basic"}>
          <section aria-label="기본 정보" className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
            <div className="grid items-center gap-7 sm:grid-cols-[minmax(0,1fr)_12rem] sm:gap-9">
              <div className="sm:order-2">
                <ProfileImagePicker key={account.id} memberId={account.id} name={account.name} savedImageUrl={account.profileImageUrl} />
              </div>
              <div className="min-w-0 border-t border-zinc-100 pt-6 sm:order-1 sm:border-t-0 sm:border-r sm:py-2 sm:pr-9">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <h2 className="break-all text-2xl font-bold tracking-tight text-zinc-950">{account.name}<span className="ml-1 text-base font-normal text-zinc-400">님</span></h2>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyle[account.status]}`}>
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                      {statusLabel[account.status]}
                    </span>
                  </div>
                </div>
                <dl className="mt-6">
                  <div>
                    <dt className="text-xs text-zinc-400">이메일</dt>
                    <dd className="mt-1.5 break-all text-sm font-medium text-zinc-700">{account.email}</dd>
                  </div>
                </dl>
                <LogoutButton />
              </div>
            </div>
          </section>
        </div>
        <section id="profile-delivery" hidden={section !== "delivery"} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
          <h2 className="text-xl font-bold text-zinc-950">배송 정보</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">배송지를 여러 개 저장하고 주문할 때 선택할 수 있어요. 기본 배송지가 자동으로 선택돼요.</p>
          <DefaultDeliverySettings key={account.id} memberId={account.id} />
          <p className="mt-6 text-xs leading-5 text-zinc-400">기본 배송지를 바꿔도 이미 생성한 주문의 배송지는 유지됩니다.</p>
        </section>
        <section id="profile-permissions" hidden={section !== "permissions"} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
          <h2 className="text-xl font-bold text-zinc-950">역할·권한</h2>
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-zinc-100 pt-5">
            <div>
              <dt className="text-xs text-zinc-500">부여된 역할</dt>
              <dd className="mt-1">
                <p className="text-xl font-bold tabular-nums text-zinc-900">{account.roles.length}<span className="ml-1 text-xs font-normal text-zinc-400">개</span></p>
                {account.roles.length ? (
                  <ul aria-label="부여된 역할" className="mt-2 flex flex-wrap gap-2">
                    {account.roles.map((role) => (
                      <li key={role.id} className="max-w-full break-words rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">{role.name}</li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-xs text-zinc-400">부여된 역할이 없어요.</p>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">사용 가능한 권한</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-zinc-900">{permissions.length}<span className="ml-1 text-xs font-normal text-zinc-400">개</span></dd>
            </div>
          </dl>
          <div className="mt-8 border-t border-zinc-100 pt-6">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-zinc-950">사용 가능한 기능</h2>
              <CountBadge count={permissions.length} />
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-500">각 역할에 연결된 권한을 중복 없이 카테고리별로 모았어요.</p>
            {permissions.length ? (
              <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
                {permissionGroups.map((category) => (
                  <section key={category.code} aria-label={`${category.name} 권한`} className="min-w-0 rounded-xl border border-zinc-100 p-4 sm:p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <h3 className="break-words text-sm font-bold text-zinc-700">{category.name}</h3>
                      <CountBadge count={category.permissions.length} />
                    </div>
                    <ul aria-label={`${category.name} 권한 목록`} className="grid gap-3">
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
          </div>
        </section>
      </div>
    </div>
  );
}

function CountBadge({ count }: { count: number }) {
  return <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-500">{count}</span>;
}


function MenuIcon({ kind }: { kind: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="hidden h-[18px] w-[18px] shrink-0 sm:block">
    {kind === "user" ? <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></> : kind === "pin" ? <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></> : <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>}
  </svg>;
}
