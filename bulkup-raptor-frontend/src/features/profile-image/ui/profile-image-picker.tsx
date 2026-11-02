"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { useProfileImagePreview } from "../model/use-profile-image-preview";
import { useSaveProfileImage } from "../model/use-save-profile-image";

export function ProfileImagePicker({ memberId, name, savedImageUrl }: {
  memberId: number;
  name: string;
  savedImageUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const errorId = useId();
  const { selectedFile, previewUrl, error, selectFile, cancelSelection, rejectPreview } = useProfileImagePreview();

  const saving = useSaveProfileImage(memberId, cancelSelection);
  const [failedSavedUrl, setFailedSavedUrl] = useState<string | null>(null);
  const imageUrl = previewUrl ?? (savedImageUrl !== failedSavedUrl ? savedImageUrl : null);

  return (
    <section aria-label="프로필 이미지 선택" aria-busy={saving.isPending} className="mx-auto w-full min-w-0 max-w-48 text-center">
      {imageUrl ? (
        <Image
          key={imageUrl}
          src={imageUrl}
          alt={previewUrl ? "선택한 프로필 이미지 미리보기" : "저장된 프로필 이미지"}
          width={160}
          height={160}
          unoptimized
          onError={() => previewUrl ? rejectPreview(previewUrl) : setFailedSavedUrl(imageUrl)}
          className="mx-auto h-36 w-36 rounded-2xl sm:h-40 sm:w-40 object-cover ring-1 ring-zinc-200"
        />
      ) : (
        <span aria-label="기본 프로필 이미지" className="mx-auto grid h-36 w-36 place-items-center sm:h-40 sm:w-40 rounded-2xl bg-emerald-100 text-5xl font-black text-emerald-800">
          {Array.from(name)[0] || "?"}
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="프로필 이미지 파일"
        disabled={saving.isPending}
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          if (file) saving.resetFeedback();
          selectFile(file);
          // 같은 파일을 연속해서 선택할 수 있도록 입력값을 비운다.
          event.currentTarget.value = "";
        }}
      />
      <div className="mt-4 flex flex-wrap justify-center gap-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={saving.isPending}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          className="disabled:cursor-wait disabled:opacity-50 cursor-pointer rounded-lg border border-zinc-200 px-2.5 py-2 text-xs font-semibold text-zinc-700 transition hover:border-emerald-400 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          {selectedFile ? "다른 이미지 선택" : "이미지 선택"}
        </button>
        {selectedFile && (
          <button type="button" onClick={() => { cancelSelection(); saving.resetFeedback(); }} disabled={saving.isPending} className="disabled:cursor-wait disabled:opacity-50 cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">선택 취소</button>
        )}
      </div>
      <button
        type="button"
        onClick={() => selectedFile && saving.save(selectedFile)}
        disabled={!selectedFile || !!error || saving.isPending}
        className="mt-3 inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving.isPending ? saving.phase === "uploading" ? "이미지 업로드 중..." : "프로필 저장 중..." : "프로필 이미지 저장"}
      </button>
      <p id={hintId} className="mt-2 text-xs leading-5 text-zinc-400">JPG·PNG·WebP · 최대 5MiB</p>
      {selectedFile && (
        <div role="status" className="mt-3 min-w-0 text-xs leading-5">
          <p className="truncate text-zinc-500" title={selectedFile.name}>
            {selectedFile.name} · {(selectedFile.size / 1024).toLocaleString("ko-KR", { maximumFractionDigits: 1 })} KiB
          </p>
          <p className="mt-1 font-medium text-emerald-700">저장 전 미리보기</p>
        </div>
      )}
      {saving.error && <p className="mt-3 text-xs leading-5 text-rose-600">{saving.error.message}</p>}
      {error && <p id={errorId} role="alert" className="mt-3 text-xs leading-5 text-rose-600">{error}</p>}
    </section>
  );
}
