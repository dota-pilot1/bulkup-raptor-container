import { createContext, useContext, type ReactNode } from "react";

type RailToggleContextValue = {
  collapsed: boolean;
  toggle: () => void;
};

const RailToggleContext = createContext<RailToggleContextValue | null>(null);

export function RailToggleProvider({
  value,
  children,
}: {
  value: RailToggleContextValue;
  children: ReactNode;
}) {
  return <RailToggleContext.Provider value={value}>{children}</RailToggleContext.Provider>;
}

/** 공용 헤더가 셸의 레일 접기 상태를 읽는 통로. 셸 밖(로그인 화면)에서는 null. */
export function useRailToggle() {
  return useContext(RailToggleContext);
}

