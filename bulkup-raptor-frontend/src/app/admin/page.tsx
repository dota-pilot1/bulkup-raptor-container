"use client";

import Link from "next/link";
import { useState, useMemo, type FormEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  productCategories,
  type Product,
  type ProductCategory,
  type ProductInput,
} from "@/entities/product/model/product";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  listAdminMembers,
  updateMemberStatus,
  currentMember,
} from "@/lib/api";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { Dialog } from "@/components/ui/dialog";
import { RbacManagement } from "@/components/admin/rbac-management";
import { MemberRoleControl } from "@/components/admin/member-role-control";
import { canAccessAdmin, accessibleAdminMenus, hasPermission, canManageAdminResource, type AdminTab } from "@/entities/session";


const emptyProductForm: ProductInput = {
  name: "",
  description: "",
  price: 0,
  category: "SUPPLEMENT",
  badge: "",
  visual: "",
};

const formatPrice = (price: number) => `${price.toLocaleString("ko-KR")}원`;

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

export default function AdminPage() {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["me"], queryFn: currentMember, refetchInterval: 15_000, refetchOnWindowFocus: true });
  const menus = accessibleAdminMenus(session.data);
  const canManageProducts = hasPermission(session.data, "PRODUCT_MANAGE");
  const canManageMembers = canManageAdminResource(session.data, "MEMBER_MANAGE");
  const canAssignRoles = canManageAdminResource(session.data, "MEMBER_ROLE_ASSIGN");
  const [activeTab, setActiveTab] = useState<AdminTab>("products");
  const selectedTab = menus.some((menu) => menu.id === activeTab) ? activeTab : menus[0]?.id;
  const canManageRbac = canManageAdminResource(session.data,
    selectedTab === "roles" ? "ROLE_MANAGE" : "PERMISSION_MANAGE");

  const canEditSelectedTab = selectedTab === "products" ? canManageProducts
    : selectedTab === "members" ? canManageMembers || canAssignRoles : canManageRbac;

  // ================= Product State =================
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: listProducts, enabled: selectedTab === "products" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [productForm, setProductForm] = useState<ProductInput>(emptyProductForm);
  const [productMessage, setProductMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>("ALL");

  const [appliedProductFilters, setAppliedProductFilters] = useState({ search: "", category: "ALL" });

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
  const saveProduct = useMutation({
    mutationFn: (input: ProductInput) =>
      editingId === null ? createProduct(input) : updateProduct(editingId, input),
    onSuccess: async () => {
      setProductMessage({
        text: editingId === null ? "상품이 성공적으로 등록되었습니다." : "상품 정보가 수정되었습니다.",
      });
      setEditingId(null);
      setProductForm(emptyProductForm);
      setIsProductFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => {
      setProductMessage({
        text: error instanceof Error ? error.message : "상품을 저장하지 못했습니다.",
        isError: true,
      });
    },
  });

  const removeProduct = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      setProductMessage({ text: "상품이 삭제되었습니다." });
      if (editingId !== null) {
        setEditingId(null);
        setProductForm(emptyProductForm);
        setIsProductFormOpen(false);
      }
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => {
      setProductMessage({
        text: error instanceof Error ? error.message : "상품을 삭제하지 못했습니다.",
        isError: true,
      });
    },
  });

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

  // ================= Product Handlers =================
  const openCreateProduct = () => {
    setEditingId(null);
    setProductForm(emptyProductForm);
    setProductMessage(null);
    setIsProductFormOpen(true);
  };

  const startEditProduct = (product: Product) => {
    setEditingId(product.id);
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      badge: product.badge ?? "",
      visual: product.visual,
    });
    setProductMessage(null);
    setIsProductFormOpen(true);
  };

  const cancelEditProduct = () => {
    setEditingId(null);
    setProductForm(emptyProductForm);
    setProductMessage(null);
    setIsProductFormOpen(false);
  };

  const handleProductSubmit = (e: FormEvent) => {
    e.preventDefault();
    setProductMessage(null);

    if (
      !productForm.name.trim() ||
      !productForm.description.trim() ||
      !productForm.visual.trim() ||
      productForm.price < 1
    ) {
      setProductMessage({
        text: "상품명, 설명, 1원 이상의 가격, 표시 이모지를 모두 입력해 주세요.",
        isError: true,
      });
      return;
    }

    saveProduct.mutate({
      ...productForm,
      name: productForm.name.trim(),
      description: productForm.description.trim(),
      badge: productForm.badge.trim(),
      visual: productForm.visual.trim(),
    });
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    if (!productsQuery.data) return [];
    return productsQuery.data.filter((product) => {
      const matchQuery =
        product.name.toLowerCase().includes(appliedProductFilters.search.toLowerCase()) ||
        product.description.toLowerCase().includes(appliedProductFilters.search.toLowerCase());
      const matchCategory =
        appliedProductFilters.category === "ALL" || product.category === appliedProductFilters.category;
      return matchQuery && matchCategory;
    });
  }, [productsQuery.data, appliedProductFilters]);

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
        <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-48">
          <nav aria-label="관리 메뉴" className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-xs">
            {menus.map(({ id: tab, label }) => {
              const count = tab === "products" ? productsQuery.data?.length ?? null
                : tab === "members" ? membersQuery.data?.statistics.total ?? null : null;
              const active = selectedTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm first:mt-0 ${
                    active ? "bg-zinc-950 font-bold text-white" : "font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                  }`}
                >
                  <span>{label}</span>
                  {count !== null && <span className={`text-xs ${active ? "text-zinc-300" : "text-zinc-400"}`}>{count}</span>}
                </button>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          {!canEditSelectedTab && <p role="status" className="mb-4 rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-600">조회 전용입니다. 등록·수정·삭제에는 별도 기능 권한이 필요합니다.</p>}

      {(selectedTab === "roles" || selectedTab === "permissions") && <RbacManagement key={`${selectedTab}:${canManageRbac}`} kind={selectedTab} canManage={canManageRbac} />}
      {/* TAB 1: PRODUCT MANAGEMENT */}
      {selectedTab === "products" && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <button
              type="button"
              disabled={!canManageProducts}
              onClick={openCreateProduct}
              className="inline-flex h-9 items-center rounded-lg bg-zinc-950 px-3.5 text-xs font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              상품 등록
            </button>
          </div>
          {productMessage && !isProductFormOpen && (
            <p className={`rounded-lg px-3 py-2 text-xs font-semibold ${productMessage.isError ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`}>
              {productMessage.text}
            </p>
          )}
          <Dialog
            isOpen={isProductFormOpen && canManageProducts}
            onClose={cancelEditProduct}
            title={editingId === null ? "상품 등록" : "상품 수정"}
            maxWidthClassName="max-w-lg"
            closeDisabled={saveProduct.isPending}
          >
            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700">
                  상품명 <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="예: 데일리 프로틴 쉐이크"
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 outline-none transition hover:border-zinc-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700">
                  설명 <span className="text-emerald-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="상품에 대한 간략한 설명"
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 outline-none transition hover:border-zinc-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700">
                  가격 (원) <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={productForm.price || ""}
                  onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                  placeholder="28000"
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 outline-none transition hover:border-zinc-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                />
              </div>

              {/* Common Select Component for Category */}
              <div>
                <Select
                  label="카테고리"
                  value={productForm.category}
                  onChange={(val) => setProductForm({ ...productForm, category: val as ProductCategory })}
                  options={productCategories.map((c) => ({ value: c.value, label: c.label }))}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700">배지 (선택)</label>
                <input
                  type="text"
                  value={productForm.badge}
                  onChange={(e) => setProductForm({ ...productForm, badge: e.target.value })}
                  placeholder="BEST, NEW, HOT 등"
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 outline-none transition hover:border-zinc-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700">
                  대표 이모지 <span className="text-emerald-600">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-200 bg-zinc-50 text-xl">
                    {productForm.visual || "❓"}
                  </div>
                  <input
                    type="text"
                    value={productForm.visual}
                    onChange={(e) => setProductForm({ ...productForm, visual: e.target.value })}
                    placeholder="🥛, 🍫, 📦 등 1개 이모지"
                    className="flex-1 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 outline-none transition hover:border-zinc-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                  />
                </div>
              </div>

              {productMessage && (
                <div
                  className={`rounded-xl p-3 text-xs font-semibold ${
                    productMessage.isError
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {productMessage.text}
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={saveProduct.isPending}
                  className="flex-1 rounded-xl bg-zinc-950 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-zinc-800 disabled:opacity-50"
                >
                  {saveProduct.isPending
                    ? "저장 중..."
                    : editingId === null
                    ? "상품 등록하기"
                    : "수정 내용 저장"}
                </button>
                <button
                  type="button"
                  onClick={cancelEditProduct}
                  disabled={saveProduct.isPending}
                  className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </form>
          </Dialog>

          <section className="space-y-4">
            {/* Filter Bar */}
            <SearchFilterBar
              label="상품명 또는 설명 검색"
              placeholder="상품명 또는 설명 검색"
              value={productSearch}
              onValueChange={setProductSearch}
              onSearch={() => setAppliedProductFilters({ search: productSearch.trim(), category: productCategoryFilter })}
              onReset={() => {
                setProductSearch("");
                setProductCategoryFilter("ALL");
                setAppliedProductFilters({ search: "", category: "ALL" });
              }}
              isDirty={productSearch.trim() !== appliedProductFilters.search || productCategoryFilter !== appliedProductFilters.category}
            >
              <div className="w-full shrink-0 lg:w-44">
                <Select
                  aria-label="상품 카테고리 필터"
                  value={productCategoryFilter}
                  onChange={setProductCategoryFilter}
                  options={[
                    { value: "ALL", label: "전체 카테고리" },
                    ...productCategories.map((c) => ({ value: c.value, label: c.label })),
                  ]}
                />
              </div>
            </SearchFilterBar>

            {/* List Content */}
            {productsQuery.isPending && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center text-sm font-medium text-zinc-500">
                상품 데이터를 불러오는 중입니다...
              </div>
            )}

            {productsQuery.isError && (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-medium text-rose-700">
                상품 목록을 불러오지 못했습니다. 백엔드 서버 상태를 확인해 주세요.
              </div>
            )}

            {productsQuery.data && filteredProducts.length === 0 && (
              <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center text-sm font-medium text-zinc-500">
                조건에 일치하는 상품이 없습니다.
              </div>
            )}

            <div className="grid gap-3">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className={`flex items-center gap-4 rounded-2xl border bg-white p-4.5 shadow-xs transition hover:border-zinc-300 ${
                    editingId === product.id ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-zinc-200/80"
                  }`}
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-zinc-100 text-2xl">
                    {product.visual}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-emerald-800">
                        {product.categoryLabel}
                      </span>
                      {product.badge && (
                        <Badge variant="default" size="sm">
                          {product.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate font-bold text-zinc-900">{product.name}</p>
                    <p className="truncate text-xs font-normal text-zinc-500">{product.description}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-bold text-zinc-900 text-sm">{formatPrice(product.price)}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 border-l border-zinc-100 pl-3">
                    <button
                      type="button"
                      disabled={!canManageProducts}
                      onClick={() => startEditProduct(product)}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 transition disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      disabled={!canManageProducts || removeProduct.isPending}
                      onClick={() => {
                        if (canManageProducts && window.confirm(`'${product.name}' 상품을 정말 삭제하시겠습니까?`)) {
                          removeProduct.mutate(product.id);
                        }
                      }}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

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
