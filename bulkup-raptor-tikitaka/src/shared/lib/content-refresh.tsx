import { createContext, useContext, type ReactNode } from "react";

type ContentRefreshContextValue = {
  refresh: () => void;
  isRefreshing: boolean;
};

const ContentRefreshContext = createContext<ContentRefreshContextValue | null>(null);

export function ContentRefreshProvider({
  value,
  children,
}: {
  value: ContentRefreshContextValue;
  children: ReactNode;
}) {
  return <ContentRefreshContext.Provider value={value}>{children}</ContentRefreshContext.Provider>;
}

export function useContentRefresh() {
  return useContext(ContentRefreshContext);
}

