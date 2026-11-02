"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { memberAddressSchema, emptyDelivery, type MemberAddress, type MemberAddressInput } from "@/entities/delivery/model/schema";
import { addressesKey, getAddresses, saveAddress, deleteAddress, makeDefaultAddress } from "@/entities/delivery/api/addresses";
import { defaultDeliveryKey } from "@/entities/delivery/api/default-delivery";
import type { MemberSession } from "@/lib/api";
import { useToast } from "@/shared/ui/toast";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";

const button = "cursor-pointer rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-40";

export function DefaultDeliverySettings({ memberId }: { memberId: number }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editor, setEditor] = useState<MemberAddress | "new" | null>(null);
  const [deleting, setDeleting] = useState<MemberAddress | null>(null);
  const addresses = useQuery({ queryKey: addressesKey(memberId), queryFn: ({ signal }) => getAddresses(signal), retry: false });
  const action = useMutation({
    mutationFn: async (command: { kind: "save"; input: MemberAddressInput; id?: number } | { kind: "delete" | "default"; id: number }) => {
      if (command.kind === "save") return saveAddress(command.input, command.id);
      if (command.kind === "delete") return deleteAddress(command.id);
      return makeDefaultAddress(command.id);
    },
    onSuccess: async (_, command) => {
      if (queryClient.getQueryData<MemberSession | null>(["me"])?.id !== memberId) return;
      setEditor(null);
      setDeleting(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: addressesKey(memberId) }),
        queryClient.invalidateQueries({ queryKey: defaultDeliveryKey(memberId) }),
      ]);
      toast.success(command.kind === "save" ? "배송지를 저장했어요." : command.kind === "delete" ? "배송지를 삭제했어요." : "기본 배송지를 변경했어요.");
    },
  });
  if (addresses.isPending) return <p role="status" className="py-6 text-sm text-zinc-500">배송지를 불러오고 있어요.</p>;
  if (addresses.isError) return <div role="alert" className="py-6 text-sm text-rose-600">배송지를 불러오지 못했어요.<button type="button" onClick={() => void addresses.refetch()} className="ml-3 cursor-pointer font-semibold underline">다시 시도</button></div>;
  function openEditor(value: MemberAddress | "new") { action.reset(); setEditor(value); }
  return <div className="mt-6 space-y-4">
    {addresses.data.length === 0 && <p className="rounded-xl bg-zinc-50 p-5 text-sm text-zinc-500">저장한 배송지가 없어요. 첫 배송지는 기본 배송지로 지정돼요.</p>}
    <ul aria-label="저장한 배송지" className="space-y-3">
      {addresses.data.map(address => <li key={address.id} className="rounded-xl border border-zinc-200 p-5">
        <div className="flex flex-wrap items-center gap-2"><h3 className="break-all font-bold text-zinc-900">{address.label}</h3>{address.defaultAddress && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">기본 배송지</span>}</div>
        <p className="mt-3 break-words text-sm font-medium text-zinc-700">{address.recipientName} · {address.phone}</p>
        <p className="mt-1 break-words text-sm leading-6 text-zinc-500">({address.postalCode}) {address.address} {address.addressDetail}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {!address.defaultAddress && <button type="button" disabled={action.isPending || editor !== null} onClick={() => action.mutate({ kind: "default", id: address.id })} className={button}>기본 배송지로 설정</button>}
          <button type="button" disabled={action.isPending} onClick={() => openEditor(address)} className={button}>수정</button>
          <button type="button" disabled={action.isPending || editor !== null} onClick={() => { action.reset(); setDeleting(address); }} className={button}>삭제</button>
        </div>
      </li>)}
    </ul>
    {editor === null ? <button type="button" disabled={action.isPending} onClick={() => openEditor("new")} className="h-11 cursor-pointer rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-40">+ 배송지 추가</button>
      : <AddressEditor key={editor === "new" ? "new" : editor.id} saved={editor === "new" ? null : editor} first={addresses.data.length === 0} pending={action.isPending}
        onSave={input => action.mutate({ kind: "save", input, id: editor === "new" ? undefined : editor.id })} onCancel={() => { setEditor(null); action.reset(); }} />}
    {action.isError && !deleting && <p role="alert" className="text-sm text-rose-600">{action.error.message || "처리하지 못했어요. 다시 시도해 주세요."}</p>}
    <ConfirmDialog isOpen={deleting !== null} title="배송지를 삭제할까요?" description={deleting?.defaultAddress ? "기본 배송지를 삭제하면 남은 배송지 중 가장 먼저 등록한 배송지가 기본으로 지정돼요. 기존 주문의 배송지는 유지됩니다." : "기존 주문의 배송지는 유지됩니다."}
      confirmLabel="삭제" isPending={action.isPending} onConfirm={() => { if (deleting) action.mutate({ kind: "delete", id: deleting.id }); }} onClose={() => { if (!action.isPending) { setDeleting(null); action.reset(); } }}>
      {deleting && <p className="break-words text-sm">{deleting.label} · {deleting.address}</p>}
      {action.isError && <p role="alert" className="mt-3 text-sm text-rose-600">{action.error.message}</p>}
    </ConfirmDialog>
  </div>;
}

function AddressEditor({ saved, first, pending, onSave, onCancel }: {
  saved: MemberAddress | null; first: boolean; pending: boolean;
  onSave: (input: MemberAddressInput) => void; onCancel: () => void;
}) {
  const form = useForm<MemberAddressInput>({ resolver: zodResolver(memberAddressSchema), defaultValues: saved ?? { ...emptyDelivery, label: "", defaultAddress: first } });
  const defaultAddress = useWatch({ control: form.control, name: "defaultAddress" });
  const fields = [
    { name: "label", label: "배송지명", autoComplete: "off", maxLength: 40, placeholder: "예: 집, 회사" },
    { name: "recipientName", label: "수령인", autoComplete: "shipping name", maxLength: 80 },
    { name: "phone", label: "연락처", autoComplete: "shipping tel", maxLength: 30, placeholder: "01012345678" },
    { name: "postalCode", label: "우편번호", autoComplete: "shipping postal-code", maxLength: 5, placeholder: "숫자 5자리" },
    { name: "address", label: "주소", autoComplete: "shipping address-line1", maxLength: 200 },
    { name: "addressDetail", label: "상세주소 (선택)", autoComplete: "shipping address-line2", maxLength: 200 },
  ] as const;
  return <form onSubmit={form.handleSubmit(onSave)} noValidate className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5">
    <h3 className="mb-5 font-bold text-zinc-900">{saved ? "배송지 수정" : "새 배송지"}</h3>
    <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
      {fields.map(field => <div key={field.name} className={field.name === "address" || field.name === "addressDetail" ? "sm:col-span-2" : ""}>
        <label htmlFor={`delivery-${field.name}`} className="mb-2 block text-sm font-semibold text-zinc-700">{field.label}</label>
        <input id={`delivery-${field.name}`} {...form.register(field.name)} maxLength={field.maxLength} autoComplete={field.autoComplete}
          type={field.name === "phone" ? "tel" : "text"} inputMode={field.name === "postalCode" ? "numeric" : undefined}
          placeholder={"placeholder" in field ? field.placeholder : undefined}
          aria-invalid={!!form.formState.errors[field.name]} aria-describedby={form.formState.errors[field.name] ? `delivery-error-${field.name}` : undefined}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-50" />
        {form.formState.errors[field.name] && <p id={`delivery-error-${field.name}`} role="alert" className="mt-1.5 text-xs text-rose-600">{form.formState.errors[field.name]?.message}</p>}
      </div>)}
      <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2"><input type="checkbox" checked={defaultAddress} onChange={event => form.setValue("defaultAddress", event.target.checked, { shouldDirty: true })} disabled={pending || first || saved?.defaultAddress} />기본 배송지로 설정</label>
    </fieldset>
    <div className="mt-6 flex gap-3">
      <button type="submit" disabled={pending || (!!saved && !form.formState.isDirty)} className="h-11 cursor-pointer rounded-xl bg-emerald-700 px-6 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-40">{pending ? "저장 중..." : "배송지 저장"}</button>
      <button type="button" disabled={pending} onClick={onCancel} className={button}>취소</button>
    </div>
  </form>;
}
