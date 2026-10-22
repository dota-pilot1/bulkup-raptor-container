import { create } from "zustand";

const CATEGORY_WIDTH_KEY = "pkt-study-category-width-v3";
const TOPIC_WIDTH_KEY = "pkt-study-topic-width-v3";
const SELECTED_MENU_KEY = "pkt-study-selected-menu-v1";

type SelectedMenu = {
  categoryId: number;
  topicId: number;
};

function readWidth(key: string, fallback: number, min: number, max: number) {
  if (typeof window === "undefined") return fallback;
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** 공간별 마지막 메뉴만 보관해 서로 다른 노트 탭의 선택이 덮어쓰지 않게 한다. */
function readSelectedMenus(): Record<string, SelectedMenu> {
  if (typeof window === "undefined") return {};

  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SELECTED_MENU_KEY) ?? "{}");
    if (!value || typeof value !== "object") return {};

    return Object.fromEntries(
      Object.entries(value).filter(([, selection]) => {
        if (!selection || typeof selection !== "object") return false;
        const { categoryId, topicId } = selection as Partial<SelectedMenu>;
        return (
          typeof categoryId === "number" &&
          Number.isInteger(categoryId) &&
          categoryId > 0 &&
          typeof topicId === "number" &&
          Number.isInteger(topicId) &&
          topicId > 0
        );
      }),
    ) as Record<string, SelectedMenu>;
  } catch {
    // 손상된 저장값은 선택 복원 없이 기본 메뉴를 사용한다.
    window.localStorage.removeItem(SELECTED_MENU_KEY);
    return {};
  }
}

type PlaybookLayoutState = {
  categoryWidth: number;
  topicWidth: number;
  categoryCollapsed: boolean;
  topicCollapsed: boolean;
  selectedMenus: Record<string, SelectedMenu>;
  selectionHydrated: boolean;
  hydrate: () => void;
  rememberSelectedMenu: (spaceCode: string, selection: SelectedMenu) => void;
  setCategoryWidth: (width: number) => void;
  setTopicWidth: (width: number) => void;
  toggleCategory: () => void;
  toggleTopic: () => void;
};

export const usePlaybookLayoutStore = create<PlaybookLayoutState>((set) => ({
  categoryWidth: 280,
  topicWidth: 300,
  categoryCollapsed: false,
  topicCollapsed: false,
  selectedMenus: {},
  selectionHydrated: false,
  hydrate: () => set({
    categoryWidth: readWidth(CATEGORY_WIDTH_KEY, 280, 240, 560),
    topicWidth: readWidth(TOPIC_WIDTH_KEY, 300, 260, 600),
    selectedMenus: readSelectedMenus(),
    selectionHydrated: true,
  }),
  rememberSelectedMenu: (spaceCode, selection) => set((state) => {
    const current = state.selectedMenus[spaceCode];
    if (current?.categoryId === selection.categoryId && current.topicId === selection.topicId)
      return state;

    const selectedMenus = { ...state.selectedMenus, [spaceCode]: selection };
    if (typeof window !== "undefined")
      window.localStorage.setItem(SELECTED_MENU_KEY, JSON.stringify(selectedMenus));
    return { selectedMenus };
  }),
  setCategoryWidth: (width) => {
    const next = Math.min(560, Math.max(240, width));
    if (typeof window !== "undefined") window.localStorage.setItem(CATEGORY_WIDTH_KEY, String(next));
    set({ categoryWidth: next });
  },
  setTopicWidth: (width) => {
    const next = Math.min(600, Math.max(260, width));
    if (typeof window !== "undefined") window.localStorage.setItem(TOPIC_WIDTH_KEY, String(next));
    set({ topicWidth: next });
  },
  toggleCategory: () => set((state) => ({ categoryCollapsed: !state.categoryCollapsed })),
  toggleTopic: () => set((state) => ({ topicCollapsed: !state.topicCollapsed })),
}));
