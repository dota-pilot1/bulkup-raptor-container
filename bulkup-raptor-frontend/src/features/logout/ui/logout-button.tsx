"use client";

import { useLogout } from "../model/use-logout";

export function LogoutButton() {
  const signOut = useLogout();
  return <>
    <button type="button" onClick={() => signOut.mutate()} disabled={signOut.isPending} className="mt-5 inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 px-4 text-xs font-semibold text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-wait disabled:opacity-50">
      {signOut.isPending ? "로그아웃 중..." : "로그아웃"}
    </button>
    {signOut.isError && <p role="alert" className="mt-3 text-xs leading-5 text-rose-600">로그아웃하지 못했어요. 다시 시도해 주세요.</p>}
  </>;
}
