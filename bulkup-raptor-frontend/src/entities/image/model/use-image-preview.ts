"use client";

import { useEffect, useState } from "react";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type PreviewState = {
  selectedFile: File | null;
  previewUrl: string | null;
  error: string | null;
};

const EMPTY_PREVIEW: PreviewState = { selectedFile: null, previewUrl: null, error: null };

export function useImagePreview() {
  const [preview, setPreview] = useState<PreviewState>(EMPTY_PREVIEW);
  const { previewUrl } = preview;

  useEffect(() => {
    if (!previewUrl) return;
    // 주소가 바뀌거나 화면을 떠나면 이전 주소를 해제한다.
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function selectFile(file: File | null) {
    // 파일 선택창을 취소하면 기존 선택을 유지한다.
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setPreview({ ...EMPTY_PREVIEW, error: "JPG, PNG, WebP 이미지를 선택해 주세요." });
      return;
    }
    if (file.size === 0 || file.size > MAX_IMAGE_SIZE) {
      setPreview({ ...EMPTY_PREVIEW, error: "크기가 0보다 크고 5MiB 이하인 이미지를 선택해 주세요." });
      return;
    }

    try {
      const previewUrl = URL.createObjectURL(file);
      setPreview({ selectedFile: file, previewUrl, error: null });
    } catch {
      setPreview({ ...EMPTY_PREVIEW, error: "이미지를 미리 볼 수 없어요. 다른 파일을 선택해 주세요." });
    }
  }

  function cancelSelection() {
    setPreview(EMPTY_PREVIEW);
  }

  function rejectPreview(failedUrl: string) {
    // 이전 이미지의 늦은 오류가 새 선택을 지우지 않도록 최신 상태를 비교한다.
    setPreview((current) => {
      if (current.previewUrl !== failedUrl) return current;
      return { ...EMPTY_PREVIEW, error: "이미지를 읽을 수 없어요. 다른 파일을 선택해 주세요." };
    });
  }

  return { ...preview, selectFile, cancelSelection, rejectPreview };
}
