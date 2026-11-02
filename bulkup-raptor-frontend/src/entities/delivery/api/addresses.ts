import { apiFetch } from "@/shared/api/client";
import type { MemberAddress, MemberAddressInput } from "../model/schema";

export const addressesKey = (memberId: number) => ["addresses", memberId] as const;
const base = "/api/auth/me/addresses";
export function getAddresses(signal?: AbortSignal) { return apiFetch<MemberAddress[]>(base, { signal }); }
export function saveAddress(input: MemberAddressInput, id?: number) {
  return apiFetch<MemberAddress>(id === undefined ? base : `${base}/${id}`, {
    method: id === undefined ? "POST" : "PUT", body: JSON.stringify(input),
  });
}
export function deleteAddress(id: number) { return apiFetch<void>(`${base}/${id}`, { method: "DELETE" }); }
export function makeDefaultAddress(id: number) { return apiFetch<MemberAddress>(`${base}/${id}/default`, { method: "PATCH" }); }
