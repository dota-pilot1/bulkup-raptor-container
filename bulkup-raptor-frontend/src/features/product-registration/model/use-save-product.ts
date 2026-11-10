"use client";

import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Product, ProductInput } from "@/entities/product/model/product";
import { useToast } from "@/shared/ui/toast";
import { registerProduct } from "../api/register-product";
import { updateProductWithImage } from "../api/update-product-with-image";

type SaveInput = { id: number | null; input: ProductInput; file: File | null };

export function useSaveProduct(onSaved: (message: string) => void, onFailed: (message: string) => void) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const saving = useRef(false);
  const mutation = useMutation({
    retry: false,
    mutationFn: async ({ id, input, file }: SaveInput) => id === null
      ? registerProduct(input, file)
      : { product: await updateProductWithImage(id, input, file), imageUploadError: null },
    onSuccess: async (response, { id }) => {
      const message = response.imageUploadError
        ? "상품은 등록되었지만 이미지를 저장하지 못했습니다."
        : id === null ? "상품이 성공적으로 등록되었습니다." : "상품 정보가 수정되었습니다.";
      // 저장 이전 조회가 확정된 상품 정보를 덮어쓰지 않도록 한다.
      await queryClient.cancelQueries({ queryKey: ["products"] });
      queryClient.setQueryData<Product[]>(["products"], (items) => {
        if (!items) return [response.product];
        return items.some((product) => product.id === response.product.id)
          ? items.map((product) => product.id === response.product.id ? response.product : product)
          : [...items, response.product];
      });
      onSaved(message);
      if (response.imageUploadError) toast.error(message);
      else toast.success(message);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (error, { id }) => {
      const detail = error instanceof Error ? error.message : "상품을 저장하지 못했습니다.";
      const message = id === null
        ? `${detail} 다시 등록하기 전에 목록에서 등록 여부를 확인해 주세요.`
        : detail;
      onFailed(message);
      toast.error(message);
      // 응답 유실로 등록 여부가 불확실할 수 있으므로 목록을 다시 조회한다.
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });

  async function save(input: SaveInput) {
    // React가 버튼을 비활성화하기 전의 연속 호출도 차단한다.
    if (saving.current) return;
    saving.current = true;
    try {
      await mutation.mutateAsync(input);
    } catch {
      // 오류는 onError에서 안내하며 입력은 유지한다.
    } finally {
      saving.current = false;
    }
  }

  return { save, isPending: mutation.isPending };
}
