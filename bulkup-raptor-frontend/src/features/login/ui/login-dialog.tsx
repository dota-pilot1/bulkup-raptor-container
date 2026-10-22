"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLogin } from "../model/use-login";
import { loginSchema, type LoginForm } from "../model/login-schema";
import { Dialog } from "@/shared/ui/dialog";

type LoginDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function LoginDialog({ isOpen, onClose }: LoginDialogProps) {
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (values: LoginForm) => {
    try {
      await loginMutation.mutateAsync(values);
      handleClose();
    } catch (error) {
      setError("root", {
        message: error instanceof Error ? error.message : "로그인에 실패했습니다.",
      });
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      closeDisabled={isSubmitting}
      title={
        <span className="flex items-center gap-1.5 text-lg font-black tracking-tight text-zinc-950">
          BULKUP<span className="text-emerald-600">.</span> 로그인
        </span>
      }
      description="로그인하고 쇼핑을 이어서 시작해 보세요."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1" noValidate>
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-zinc-700">
            이메일 <span className="text-emerald-600">*</span>
          </label>
          <input
            {...register("email")}
            type="email"
            placeholder="example@email.com"
            autoComplete="email"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 aria-invalid:border-rose-400"
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && (
            <p className="text-xs font-medium text-rose-500" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-zinc-700">
            비밀번호 <span className="text-emerald-600">*</span>
          </label>
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              placeholder="비밀번호를 입력해 주세요"
              autoComplete="current-password"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 pr-12 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 aria-invalid:border-rose-400"
              aria-invalid={Boolean(errors.password)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400 hover:text-zinc-700 transition"
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
            >
              {showPassword ? "숨김" : "보기"}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs font-medium text-rose-500" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        {errors.root && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600" role="alert">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white">!</span>
            <p>{errors.root.message}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 flex w-full items-center justify-center rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            "로그인"
          )}
        </button>

        <p className="pt-2 text-center text-xs text-zinc-500">
          아직 회원이 아니신가요?{" "}
          <Link
            href="/signup"
            onClick={handleClose}
            className="font-bold text-emerald-600 hover:underline"
          >
            회원가입
          </Link>
        </p>
      </form>
    </Dialog>
  );
}
