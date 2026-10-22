"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLogin, loginSchema, type LoginForm } from "@/features/login";

export default function LoginPage() {
  const router = useRouter();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginForm) => {
    try {
      await loginMutation.mutateAsync(values);
      router.push("/");
    } catch (error) {
      setError("root", { message: error instanceof Error ? error.message : "로그인에 실패했습니다." });
    }
  };

  return (
    <main className="signup-page">
      <div className="signup-shell">
        <header className="signup-header">
          <Link href="/" className="signup-logo" aria-label="Bulkup 홈으로 이동">BULKUP<span>.</span></Link>
          <Link href="/" className="signup-back-link">홈으로 돌아가기</Link>
        </header>
        <section className="signup-card" aria-labelledby="login-title">
          <div className="signup-intro">
            <div className="signup-eyebrow">BULKUP RAPTOR MEMBERSHIP</div>
            <h1 id="login-title">다시 만나서<br /><span>반가워요.</span></h1>
            <p>가입한 이메일과 비밀번호로 로그인하면 쇼핑을 이어서 할 수 있어요.</p>
          </div>
          <form className="signup-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="signup-form-heading">
              <div>
                <h2>로그인</h2>
                <p><span aria-hidden="true">*</span> 표시는 필수 항목입니다.</p>
              </div>
            </div>
            <div className="signup-fields">
              <label className="signup-field">
                <span className="signup-label">이메일 <b aria-label="필수">*</b></span>
                <input {...register("email")} type="email" className="signup-input" placeholder="example@email.com" autoComplete="email" aria-invalid={Boolean(errors.email)} />
                {errors.email && <span className="signup-error" role="alert">{errors.email.message}</span>}
              </label>
              <label className="signup-field">
                <span className="signup-label">비밀번호 <b aria-label="필수">*</b></span>
                <div className="password-wrap">
                  <input {...register("password")} type={showPassword ? "text" : "password"} className="signup-input" placeholder="비밀번호를 입력해 주세요" autoComplete="current-password" aria-invalid={Boolean(errors.password)} />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>{showPassword ? "숨김" : "보기"}</button>
                </div>
                {errors.password && <span className="signup-error" role="alert">{errors.password.message}</span>}
              </label>
            </div>
            {errors.root && <div className="signup-alert" role="alert"><span aria-hidden="true">!</span><p>{errors.root.message}</p></div>}
            <button type="submit" className="signup-submit" disabled={isSubmitting}>{isSubmitting ? "로그인 중입니다..." : "로그인"}</button>
            <p className="signup-login-prompt">아직 회원이 아니신가요? <Link href="/signup">회원가입</Link></p>
          </form>
        </section>
        <p className="signup-footer">© 2026 Bulkup Raptor · 로그인은 이 브라우저 세션 동안 유지됩니다.</p>
      </div>
    </main>
  );
}
