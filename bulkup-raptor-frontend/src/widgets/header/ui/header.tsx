"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { catalogNav, categoryFromQuery, categoryHref } from "@/entities/product/model/product";
import { currentMember, logout } from "@/lib/api";
import { canAccessAdmin, MemberAvatar, type MemberSession } from "@/entities/session";
import { useCart } from "@/entities/cart/model/use-cart";
import { ApiError } from "@/shared/api/client";
import { LoginDialog } from "@/features/login";
import { SearchDialog } from "./search-dialog";
import { CartDrawer } from "./cart-drawer";

function CategoryNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = pathname === "/" ? categoryFromQuery(searchParams.get("category")) : null;

  return (
    <nav className="hidden items-center gap-5 whitespace-nowrap text-sm font-medium text-zinc-600 lg:flex" aria-label="상품 카테고리">
      {catalogNav.map((category) => (
        <a
          key={category.value}
          href={categoryHref(category.value)}
          aria-current={selected === category.value ? "page" : undefined}
          className={`transition hover:text-zinc-950 ${selected === category.value ? "font-semibold text-zinc-950" : ""}`}
        >
          {category.label}
        </a>
      ))}
    </nav>
  );
}

export function Header({ fullWidth = false, initialCartOpen = false }: { fullWidth?: boolean; initialCartOpen?: boolean }) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(initialCartOpen);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const member = useQuery({ queryKey: ["me"], queryFn: currentMember });
  const memberId = member.data?.id ?? null;
  const cart = useCart(memberId);
  const showAdminMenu = canAccessAdmin(member.data);
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.setQueryData(["me"], null);
      queryClient.removeQueries({ queryKey: ["cart"] });
      queryClient.removeQueries({ queryKey: ["orders"] });
      queryClient.removeQueries({ queryKey: ["deliveries"] });
      queryClient.removeQueries({ queryKey: ["default-delivery"] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
  const itemCount = cart.isError ? undefined : cart.data?.items.length;

  useEffect(() => {
    if (!(cart.error instanceof ApiError) || cart.error.status !== 401 || memberId === null) return;
    if (queryClient.getQueryData<MemberSession | null>(["me"])?.id !== memberId) return;
    queryClient.setQueryData(["me"], null);
    queryClient.removeQueries({ queryKey: ["cart"] });
      queryClient.removeQueries({ queryKey: ["orders"] });
      queryClient.removeQueries({ queryKey: ["deliveries"] });
      queryClient.removeQueries({ queryKey: ["default-delivery"] });
  }, [cart.error, memberId, queryClient]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (event.key === "Escape") setIsAccountOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isAccountOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setIsAccountOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isAccountOpen]);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-[#fafafa]/95 backdrop-blur">
        <div className={`mx-auto flex h-18 items-center gap-4 lg:gap-8 ${fullWidth ? "w-full px-4 sm:px-6" : "max-w-7xl px-4 sm:px-10"}`}>
          <Link href="/" className="shrink-0 text-lg font-black tracking-[0.12em] text-zinc-950">BULKUP<span className="text-emerald-600">.</span></Link>
          <Suspense fallback={<nav className="hidden h-5 lg:block" aria-hidden="true" />}>
            <CategoryNav />
          </Suspense>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="상품 검색"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-100/80 text-sm font-medium text-zinc-500 transition hover:bg-zinc-200/70 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto sm:px-3.5 xl:min-w-44 xl:justify-start"
            >
              <svg className="h-4 w-4 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden sm:inline">상품 검색</span>
              <kbd className="ml-auto hidden rounded-md bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-zinc-400 xl:inline-block">
                ⌘K
              </kbd>
            </button>
            <span className="mx-1 hidden h-5 w-px bg-zinc-200 sm:block" aria-hidden="true" />

            {showAdminMenu && (
              <nav aria-label="운영 업무" className="hidden items-center gap-1.5 lg:flex">
              <Link
                href="/admin"
                className="hidden h-10 items-center justify-center rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 lg:inline-flex"
              >
                운영 관리
              </Link>
              <Link href="/admin/deliveries"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
                배송 관리
              </Link>
              </nav>
            )}

            {member.data ? (
              <div ref={accountRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsAccountOpen((open) => !open)}
                  aria-label={`${member.data.name} 계정 메뉴`}
                  className={`flex h-10 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:px-3 ${isAccountOpen ? "bg-zinc-100" : ""}`}
                  aria-expanded={isAccountOpen}
                  aria-haspopup="menu"
                >
                  <MemberAvatar name={member.data.name} imageUrl={member.data.profileImageUrl} />
                  <span className="hidden max-w-28 truncate text-sm font-semibold text-zinc-900 sm:block">
                    {member.data.name}
                    <span className="ml-0.5 text-[11px] font-normal text-zinc-400">님</span>
                  </span>
                  <svg className={`hidden h-3.5 w-3.5 text-zinc-400 transition sm:block ${isAccountOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isAccountOpen && (
                  <div role="menu" className="absolute right-0 top-[calc(100%+12px)] z-30 w-60 rounded-2xl border border-zinc-200/80 bg-white p-2 text-left shadow-xl shadow-zinc-950/10">
                    <div className="px-4 py-2">
                      <p className="text-sm font-bold text-zinc-950">{member.data.name}</p>
                      <p className="truncate text-xs text-zinc-500">{member.data.email}</p>
                    </div>
                    <div className="mx-2 my-1 h-px bg-zinc-100" />
                    <div className="px-1.5">
                      <a
                        href="/profile"
                        role="menuitem"
                        className="flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
                      >
                        내 정보
                      </a>
                      <Link
                        href="/orders"
                        onClick={() => setIsAccountOpen(false)}
                        role="menuitem"
                        className="flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
                      >
                        주문 내역
                      </Link>
                      {showAdminMenu && (
                        <div className="lg:hidden">
                          <div role="separator" className="mx-2 my-1 h-px bg-zinc-100" />
                          <a
                            href="/admin"
                            role="menuitem"
                            className="flex min-h-10 items-center justify-between gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
                          >
                            운영 관리
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 17 17 7M7 7h10v10" />
                            </svg>
                          </a>
                          <Link href="/admin/deliveries" role="menuitem" onClick={() => setIsAccountOpen(false)}
                            className="flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50">
                            배송 관리
                          </Link>
                        </div>
                      )}
                      <div role="separator" className="mx-2 my-1 h-px bg-zinc-100" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsAccountOpen(false);
                          signOut.mutate();
                        }}
                        disabled={signOut.isPending}
                        className="flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950 cursor-pointer disabled:opacity-50"
                      >
                        {signOut.isPending ? "로그아웃 중..." : "로그아웃"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <a
                  href="/signup"
                  className="hidden h-10 items-center justify-center rounded-xl px-3 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:inline-flex"
                >
                  회원가입
                </a>
                <button
                  type="button"
                  onClick={() => setIsLoginOpen(true)}
                  className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-zinc-950 px-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:px-4"
                >
                  로그인
                </button>
              </div>
            )}

            {memberId !== null && cart.isError && !(cart.error instanceof ApiError && cart.error.status === 401) && (
              <button
                type="button"
                onClick={() => void cart.refetch()}
                disabled={cart.isFetching}
                aria-label="장바구니 수량 조회 실패. 다시 시도"
                title="장바구니 수량을 불러오지 못했습니다. 다시 시도하세요."
                className="grid h-8 w-8 place-items-center rounded-lg text-sm font-bold text-rose-600 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:opacity-50"
              >
                !
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsCartOpen(true);
                if (memberId !== null && !cart.isFetching) void cart.refetch({ cancelRefetch: false });
              }}
              className="relative grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-emerald-600"
              aria-label={itemCount !== undefined && itemCount > 0 ? `장바구니 열기, 상품 ${itemCount}종` : "장바구니 열기"}
            >
              <svg className="h-4.5 w-4.5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              {itemCount !== undefined && itemCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-extrabold text-white ring-2 ring-white">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <LoginDialog isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      <SearchDialog isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onLogin={() => { setIsCartOpen(false); setIsLoginOpen(true); }}
        member={member}
        cart={cart}
      />
    </>
  );
}
