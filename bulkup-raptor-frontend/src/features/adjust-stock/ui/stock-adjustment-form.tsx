"use client";

import { useEffect, useRef, useState } from "react";
import { useStockAdjustment } from "../model/use-stock-adjustment";
import { useController, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/shared/ui/toast";
import { createStockAdjustmentSchema, validateStockAdjustment, type StockAdjustmentFormValues } from "../model/validate-stock-adjustment";

export function StockAdjustmentForm({ productId, memberId, currentStock, disabled, onRefresh }: {
  productId: number; memberId: number; currentStock: number; disabled: boolean;
  onRefresh: (productId: number) => void;
}) {
  const toast = useToast();
  const [message, setMessage] = useState<string | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const form = useForm<StockAdjustmentFormValues>({
    resolver: zodResolver(createStockAdjustmentSchema(currentStock)),
    defaultValues: { direction: "increase", quantity: "", reason: "" },
    mode: "onChange",
    reValidateMode: "onChange",
  });
  const reason = useWatch({ control: form.control, name: "reason" }) ?? "";
  const { field: directionField } = useController({ control: form.control, name: "direction" });
  const { register, handleSubmit, reset, trigger, getValues, setError, formState: { errors, isSubmitting } } = form;
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const { save, review, isPending } = useStockAdjustment(productId, memberId, onRefresh);
  const locked = disabled || isPending || isSubmitting || needsReview;
  const id = `stock-change-${memberId}-${productId}`;
  const quantityError = errors.quantity?.message;
  const reasonError = errors.reason?.message;
  useEffect(() => {
    if (getValues("quantity")) void trigger("quantity");
  }, [currentStock, getValues, trigger]);
  const inputBorder = (error?: string) => error
    ? "border-rose-500 bg-rose-50 focus:border-rose-600 focus:ring-2 focus:ring-rose-100"
    : "border-zinc-200 focus:border-emerald-600";

  function edit() { setMessage(null); }

  function resetInput() {
    reset({ direction: getValues("direction"), quantity: "", reason: "" });
  }

  async function submit(values: StockAdjustmentFormValues) {
    if (disabled || isPending || needsReview) return;
    const checked = validateStockAdjustment(values.direction, values.quantity, values.reason, currentStock);
    if (!checked.valid) return;
    setMessage(null);
    const result = await save(checked.request);
    if (!mounted.current || result.status === "ignored") return;
    if (result.status === "saved") {
      resetInput();
      toast.success("재고 변경을 저장했습니다.");
      setMessage(result.refreshFailed
        ? "재고 변경은 저장됐지만 일부 조회에 실패했습니다. 새로고침으로 최신 정보를 확인해 주세요."
        : null);
    } else if (result.status === "uncertain" || result.status === "rejected") {
      setNeedsReview(result.status === "uncertain");
      if (result.status === "rejected") {
        for (const field of ["quantity", "reason"] as const) {
          const error = result.fieldErrors?.[field];
          if (error) setError(field, { type: "server", message: error });
        }
      }
      setMessage(result.message);
    }
  }

  async function checkResult() {
    if (isPending) return;
    const result = await review();
    if (!mounted.current || result.status === "ignored") return;
    if (result.status === "reviewed" && !result.refreshFailed) {
      setNeedsReview(false);
      resetInput();
      setMessage(null);
      toast.success("최신 재고와 이력을 조회했습니다. 이력에서 반영 여부를 확인한 뒤 새 변경을 입력해 주세요.");
    } else {
      setMessage("최신 정보를 조회하지 못했습니다. 저장을 다시 누르지 말고 재고와 이력을 다시 확인해 주세요.");
    }
  }

  return <form aria-label="재고 변경" onSubmit={(event) => void handleSubmit(submit)(event)} noValidate className="space-y-3 border-t border-zinc-100 pt-4" aria-busy={isPending}>
    <div><h3 className="font-bold text-zinc-950">재고 변경</h3><p className="mt-1 text-xs text-zinc-500">수량과 사유를 입력하면 변경 이력에 함께 기록됩니다.</p></div>
    <fieldset disabled={locked} className="space-y-3 disabled:opacity-60">
      <legend className="sr-only">재고 변경 입력</legend>
      <div className="grid max-w-xs grid-cols-2 gap-2">
        {(["increase", "decrease"] as const).map((value) => <label key={value}
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${directionField.value === value ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-zinc-200 text-zinc-600"}`}>
          <input type="radio" name={directionField.name} ref={directionField.ref} value={value}
            checked={directionField.value === value} onBlur={directionField.onBlur}
            onChange={() => { directionField.onChange(value); edit(); void trigger("quantity"); }} className="accent-emerald-700" />
          {value === "increase" ? "증가" : "감소"}
        </label>)}
      </div>
      <div><label htmlFor={`${id}-quantity`} className="text-sm font-semibold text-zinc-700">변경 수량</label>
        <div className="mt-1.5 flex items-center gap-2"><input id={`${id}-quantity`} inputMode="numeric" type="text" autoComplete="off"
          {...register("quantity", { onChange: edit })} placeholder="1 이상 입력"
          aria-invalid={Boolean(quantityError)} aria-describedby={quantityError ? `${id}-quantity-error` : undefined}
          className={`h-10 w-40 max-w-full rounded-lg border px-3 text-sm sm:h-9 outline-none ${inputBorder(quantityError)}`} /><span className="text-sm text-zinc-500">개</span></div>
        {quantityError && <p id={`${id}-quantity-error`} role="alert" className="mt-1.5 text-xs font-medium text-rose-700">{quantityError}</p>}
      </div>
      <div><label htmlFor={`${id}-reason`} className="text-sm font-semibold text-zinc-700">변경 사유</label>
        <textarea id={`${id}-reason`} {...register("reason", { onChange: edit })} rows={2}
          placeholder="입고, 파손, 실사 조정 등" aria-invalid={Boolean(reasonError)}
          aria-describedby={`${id}-reason-help${reasonError ? ` ${id}-reason-error` : ""}`}
          className={`mt-1.5 block w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none ${inputBorder(reasonError)}`} />
        <p id={`${id}-reason-help`} className={`mt-1 text-xs ${reasonError ? "text-rose-700" : "text-zinc-500"}`}>앞뒤 공백을 제외하고 {reason.trim().length} / 200자</p>
        {reasonError && <p id={`${id}-reason-error`} role="alert" className="mt-1.5 text-xs font-medium text-rose-700">{reasonError}</p>}
      </div>
    </fieldset>
    <p className="text-xs text-zinc-500">서버는 저장 시점의 최신 재고를 기준으로 변경합니다.</p>
    {message && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{message}</p>}
    {needsReview ? <button type="button" disabled={isPending} onClick={() => void checkResult()}
      className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 disabled:opacity-40">{isPending ? "확인 중…" : "재고와 이력 다시 확인"}</button>
      : <button type="submit" disabled={locked}
        className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40">{isPending ? "저장 중…" : "재고 변경 저장"}</button>}
  </form>;
}
