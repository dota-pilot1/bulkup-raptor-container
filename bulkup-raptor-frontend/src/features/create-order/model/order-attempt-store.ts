import { useCallback, useSyncExternalStore } from "react";
import type { CreateOrderRequest } from "@/entities/order/model/order-types";
import { createOrderRequestSchema } from "./order-form-schema";

// 회원별·탭별 보관이다. 성공 여부가 불명확한 요청은 같은 본문으로 재시도한다.
const entries = new Map<number, { raw: string | null; value: CreateOrderRequest | null; memoryOnly?: boolean }>();
const listeners = new Set<() => void>();
const key = (memberId: number) => `order-attempt:${memberId}`;

export function readOrderAttempt(memberId: number): CreateOrderRequest | null {
  if (typeof window === "undefined") return entries.get(memberId)?.value ?? null;
  if (entries.get(memberId)?.memoryOnly) return entries.get(memberId)!.value;
  let raw: string | null;
  try { raw = window.sessionStorage.getItem(key(memberId)); }
  catch { return entries.get(memberId)?.value ?? null; }
  const cached = entries.get(memberId);
  if (cached?.raw === raw) return cached.value;
  let value: CreateOrderRequest | null = null;
  try {
    const parsed = createOrderRequestSchema.safeParse(JSON.parse(raw ?? "null"));
    if (parsed.success) value = parsed.data;
  } catch { /* 손상된 보관 데이터는 요청에 사용하지 않는다. */ }
  entries.set(memberId, { raw, value });
  return value;
}

export function saveOrderAttempt(memberId: number, value: CreateOrderRequest | null) {
  const raw = value ? JSON.stringify(value) : null;
  entries.set(memberId, { raw, value });
  if (typeof window !== "undefined") {
    try {
      if (raw === null) window.sessionStorage.removeItem(key(memberId));
      else window.sessionStorage.setItem(key(memberId), raw);
    } catch { entries.set(memberId, { raw, value, memoryOnly: true }); }
  }
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const serverSnapshot = () => null;
export function useOrderAttempt(memberId: number | null) {
  const snapshot = useCallback(() => memberId === null ? null : readOrderAttempt(memberId), [memberId]);
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
