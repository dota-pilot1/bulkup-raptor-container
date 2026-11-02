"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadImage } from "@/entities/image";
import type { MemberSession } from "@/entities/session";
import { useToast } from "@/shared/ui/toast";
import { updateProfileImage } from "../api/update-profile-image";

function message(error: unknown) {
  return error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.";
}

export function useSaveProfileImage(memberId: number, onSaved: () => void) {
  const queryClient = useQueryClient();
  const toast = useToast();
  // 버튼 문구에 표시할 현재 요청 단계이다.
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  // 업로드 성공 응답을 받은 파일과 key를 기억한다. 아직 프로필 연결 성공을 뜻하지 않는다.
  // 연결만 실패했을 때, 다음 저장 클릭에서 같은 파일을 재업로드하지 않도록 사용한다.
  const [uploaded, setUploaded] = useState<{ file: File; key: string } | null>(null);
  // 같은 이벤트 처리 구간에서 저장을 연속 호출해도 요청은 한 번만 시작한다.
  const saving = useRef(false);
  const mutation = useMutation({
    // 실패해도 자동으로 반복 요청하지 않는다. 사용자가 저장 버튼을 다시 눌러야 한다.
    retry: false,
    mutationFn: async (file: File) => {
      // 이전 업로드에 성공한 File 객체와 지금 저장하려는 File 객체가 같은지 확인한다.
      // 같으면 기존 key를 사용한다. 이름이 같은 파일이라는 뜻은 아니다.
      let key = uploaded?.file === file ? uploaded.key : null;
      // 1단계: 사용할 key가 없을 때만 업로드한다. (POST /api/images)
      // 최초 저장 또는 이전 업로드 실패 후 다시 저장하면 이 구간을 실행한다.
      if (!key) {
        setPhase("uploading");
        try {
          const image = await uploadImage(file);
          key = image.key;
          // 업로드는 끝났지만 프로필에는 아직 연결하지 않은 상태이다.
          // 아래 연결 요청이 실패해도 이 정보를 남겨 다음 저장 클릭에서 key를 재사용한다.
          setUploaded({ file, key });
        } catch (error) {
          // 업로드 성공 응답을 받지 못했으므로 프로필 연결 요청으로 넘어가지 않는다.
          // 사용할 key가 없으므로 다음 저장 클릭에서도 업로드부터 시작한다.
          throw new Error(`이미지 업로드에 실패했어요. ${message(error)}`);
        }
      }
      // 2단계: 업로드한 key를 회원 프로필에 연결한다. (PATCH /api/auth/me/profile-image)
      // 이전에 업로드만 성공했다면 1단계를 건너뛰고 이 요청만 다시 보낸다.
      setPhase("saving");
      try {
        return await updateProfileImage(key);
      } catch (error) {
        // 연결 실패여도 uploaded는 지우지 않는다. 같은 파일로 다시 저장할 때 key를 사용한다.
        throw new Error(`프로필 이미지 저장에 실패했어요. ${message(error)}`);
      }
    },
    // 업로드 성공만으로 실행되지 않는다. 프로필 연결까지 성공해야 실행된다.
    onSuccess: async (response) => {
      // 진행 중이던 회원 조회가 저장 전 이미지로 캐시를 덮어쓰지 않도록 한다.
      await queryClient.cancelQueries({ queryKey: ["me"] });
      // 페이지와 헤더가 공유하는 회원 캐시에 서버가 확정한 주소를 반영한다.
      // 저장 중 로그인 계정이 바뀌었다면 다른 회원의 캐시는 변경하지 않는다.
      queryClient.setQueryData<MemberSession | null>(["me"], (member) =>
        member?.id === memberId ? { ...member, profileImageUrl: response.profileImageUrl } : member);
      // 연결까지 끝났으므로 보관하던 파일과 key를 비운다.
      setUploaded(null);
      // 전달받은 콜백으로 파일 선택과 로컬 미리보기를 정리한다.
      onSaved();
      toast.success("프로필 이미지가 저장되었어요.");
    },
    onError: (error) => toast.error(error.message),
    // 성공·실패와 관계없이 진행 문구를 끝낸다. 보관한 key를 지우는 처리는 아니다.
    onSettled: () => setPhase("idle"),
  });

  // 저장 버튼을 누를 때 호출한다. 실패 후 다시 누르면 필요한 단계부터 실행한다.
  async function save(file: File) {
    if (saving.current) return;
    saving.current = true;
    try {
      await mutation.mutateAsync(file);
    } catch {
      // onError에서 토스트로 알리고, mutation.error로 화면에도 오류를 남긴다.
    } finally {
      saving.current = false;
    }
  }

  // 새 파일을 선택하거나 선택을 취소할 때 호출한다.
  function resetFeedback() {
    if (saving.current) return;
    // 이전 성공·오류 안내와 업로드 key 보관 정보를 지운다.
    // 서버에 저장된 파일 자체를 삭제하는 동작은 아니다.
    mutation.reset();
    setUploaded(null);
  }

  return {
    save,
    resetFeedback,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    phase,
  };
}
