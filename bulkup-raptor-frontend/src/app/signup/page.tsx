"use client";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type UseFormRegister } from "react-hook-form";
import { z } from "zod";
import { confirmEmailVerification, requestEmailVerification, signup } from "@/lib/api";

const signupSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(50, "이름은 50자 이하로 입력해 주세요."),
  email: z.string().trim().email("올바른 이메일을 입력해 주세요.").max(254, "이메일은 254자 이하로 입력해 주세요."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(72, "비밀번호는 72자 이하로 입력해 주세요.").regex(/[A-Za-z]/, "영문을 포함해 주세요.").regex(/\d/, "숫자를 포함해 주세요."),
  passwordConfirm: z.string().min(1, "비밀번호 확인을 입력해 주세요."),
  termsAgreed: z.boolean().refine(Boolean, "이용약관에 동의해 주세요."),
  privacyAgreed: z.boolean().refine(Boolean, "개인정보 처리방침에 동의해 주세요."),
}).refine((value) => value.password === value.passwordConfirm, { path: ["passwordConfirm"], message: "비밀번호가 일치하지 않습니다." });

type SignupForm = z.infer<typeof signupSchema>;
type VerificationStep = "idle" | "sending" | "sent" | "confirming" | "verified" | "expired";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [verificationStep, setVerificationStep] = useState<VerificationStep>("idle");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const { control, register, handleSubmit, getValues, trigger, setValue, setError, formState: { errors, isSubmitting } } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema), mode: "onBlur",
    defaultValues: { name: "", email: "", password: "", passwordConfirm: "", termsAgreed: false, privacyAgreed: false },
  });
  const termsAgreed = useWatch({ control, name: "termsAgreed" });
  const privacyAgreed = useWatch({ control, name: "privacyAgreed" });
  const password = useWatch({ control, name: "password" });
  const allAgreed = termsAgreed && privacyAgreed;

  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const timer = window.setInterval(() => setRemainingSeconds((seconds) => Math.max(seconds - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [remainingSeconds]);

  const isVerificationExpired = verificationStep === "sent" && remainingSeconds === 0;
  const emailRegistration = register("email");
  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    emailRegistration.onChange(event);
    if (verifiedEmail && normalizeEmail(event.target.value) !== verifiedEmail) {
      setVerificationStep("idle");
      setVerificationCode("");
      setVerificationToken(null);
      setVerifiedEmail(null);
      setVerificationMessage("이메일이 변경되어 다시 인증해 주세요.");
    }
  };

  const requestVerification = async () => {
    const valid = await triggerEmailValidation();
    if (!valid) return;
    const normalizedEmail = normalizeEmail(getValues("email"));
    setVerificationStep("sending");
    setVerificationMessage(null);
    try {
      await requestEmailVerification(normalizedEmail);
      setVerificationStep("sent");
      setRemainingSeconds(300);
      setVerificationCode("");
      setVerificationToken(null);
      setVerificationMessage("인증번호를 이메일로 보냈습니다. 5분 안에 입력해 주세요.");
    } catch (error) {
      setVerificationStep("idle");
      setVerificationMessage(error instanceof Error ? error.message : "인증번호를 보내지 못했습니다.");
    }
  };

  const confirmVerification = async () => {
    if (isVerificationExpired) {
      setVerificationMessage("인증번호가 만료되었습니다. 다시 요청해 주세요.");
      return;
    }
    if (!/^\d{6}$/.test(verificationCode)) {
      setVerificationMessage("인증번호 6자리를 입력해 주세요.");
      return;
    }
    setVerificationStep("confirming");
    setVerificationMessage(null);
    try {
      const result = await confirmEmailVerification(normalizeEmail(getValues("email")), verificationCode);
      setVerificationToken(result.verificationToken);
      setVerifiedEmail(result.email);
      setVerificationStep("verified");
      setVerificationMessage("이메일 인증이 완료되었습니다.");
      setRemainingSeconds(0);
    } catch (error) {
      setVerificationStep("sent");
      setVerificationMessage(error instanceof Error ? error.message : "인증번호를 확인하지 못했습니다.");
    }
  };

  const triggerEmailValidation = async () => {
    const valid = await trigger("email");
    if (!valid) setVerificationMessage("먼저 올바른 이메일을 입력해 주세요.");
    return valid;
  };

  const onSubmit = async (values: SignupForm) => {
    try {
      if (!verificationToken || verifiedEmail !== normalizeEmail(values.email)) {
        setError("root", { message: "이메일 인증을 먼저 완료해 주세요." });
        return;
      }
      await signup({ ...values, email: normalizeEmail(values.email), name: values.name.trim(), emailVerificationToken: verificationToken });
      setIsComplete(true);
    } catch (error) {
      setError("root", { message: error instanceof Error ? error.message : "회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요." });
    }
  };

  if (isComplete) return <SignupComplete />;

  return <main className="signup-page"><div className="signup-shell">
    <header className="signup-header"><Link href="/" className="signup-logo" aria-label="Bulkup 홈으로 이동">BULKUP<span>.</span></Link><Link href="/" className="signup-back-link">홈으로 돌아가기</Link></header>
    <section className="signup-card" aria-labelledby="signup-title">
      <div className="signup-intro"><div className="signup-eyebrow">BULKUP RAPTOR MEMBERSHIP</div><h1 id="signup-title">건강한 루틴을<br /><span>오늘부터 시작해 보세요.</span></h1><p>회원이 되면 주문 내역과 맞춤 쇼핑 혜택을 한곳에서 관리할 수 있어요.</p></div>
      <form className="signup-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="signup-form-heading"><div><h2>회원 정보 입력</h2><p><span aria-hidden="true">*</span> 표시는 필수 항목입니다.</p></div><span className="signup-step">01 <i>/</i> 01</span></div>
        <div className="signup-fields">
          <Field label="이름" required error={errors.name?.message}><input {...register("name")} className="signup-input" placeholder="이름을 입력해 주세요" autoComplete="name" aria-invalid={Boolean(errors.name)} /></Field>
          <Field label="이메일" required error={errors.email?.message} hint="로그인과 주문 안내에 사용됩니다."><div className="verification-email-row"><input {...emailRegistration} onChange={handleEmailChange} type="email" className="signup-input" placeholder="example@email.com" autoComplete="email" aria-invalid={Boolean(errors.email)} /><button type="button" className={`verification-button ${verificationStep === "verified" ? "verified" : ""}`} onClick={requestVerification} disabled={verificationStep === "sending" || verificationStep === "confirming" || verificationStep === "verified"}>{verificationStep === "sending" ? "발송 중" : verificationStep === "verified" ? "인증 완료" : verificationStep === "sent" || isVerificationExpired ? "재발송" : "인증 요청"}</button></div>{(verificationStep === "sent" || verificationStep === "confirming") && <div className="verification-code-row"><input className="signup-input" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="인증번호 6자리" aria-label="이메일 인증번호" disabled={verificationStep === "confirming"} /><button type="button" className="verification-confirm" onClick={confirmVerification} disabled={verificationStep === "confirming" || isVerificationExpired}>{verificationStep === "confirming" ? "확인 중" : "확인"}</button></div>}{verificationStep === "sent" && !isVerificationExpired && <span className="verification-timer">남은 시간 {formatRemainingTime(remainingSeconds)}</span>}{verificationStep === "verified" && <span className="verification-success" role="status">✓ 인증된 이메일입니다.</span>}{(verificationMessage || isVerificationExpired) && <span className={`verification-message ${verificationStep === "verified" ? "success" : ""}`} role="status">{isVerificationExpired ? "인증번호가 만료되었습니다. 다시 요청해 주세요." : verificationMessage}</span>}</Field>
          <Field label="비밀번호" required error={errors.password?.message} hint="영문과 숫자를 포함해 8~72자로 입력해 주세요."><PasswordInput register={register} name="password" visible={showPassword} onToggle={() => setShowPassword((value) => !value)} invalid={Boolean(errors.password)} /><PasswordMeter password={password} /></Field>
          <Field label="비밀번호 확인" required error={errors.passwordConfirm?.message}><PasswordInput register={register} name="passwordConfirm" visible={showPasswordConfirm} onToggle={() => setShowPasswordConfirm((value) => !value)} invalid={Boolean(errors.passwordConfirm)} /></Field>
        </div>
        <section className="signup-consents" aria-labelledby="consent-title"><div className="consent-heading"><h2 id="consent-title">약관 동의</h2><button type="button" className="consent-all" onClick={() => { setValue("termsAgreed", !allAgreed, { shouldValidate: true }); setValue("privacyAgreed", !allAgreed, { shouldValidate: true }); }}>{allAgreed ? "전체 해제" : "전체 동의"}</button></div><ConsentRow id="termsAgreed" label="이용약관에 동의합니다." register={register} checked={termsAgreed} error={errors.termsAgreed?.message} /><ConsentRow id="privacyAgreed" label="개인정보 처리방침에 동의합니다." register={register} checked={privacyAgreed} error={errors.privacyAgreed?.message} /></section>
        {errors.root && <div className="signup-alert" role="alert"><span aria-hidden="true">!</span><p>{errors.root.message}</p></div>}
        <button type="submit" className="signup-submit" disabled={isSubmitting || verificationStep !== "verified"}>{isSubmitting ? <><span className="signup-spinner" aria-hidden="true" />가입 처리 중입니다...</> : verificationStep !== "verified" ? "이메일 인증 후 가입할 수 있어요" : "회원가입 완료"}</button><p className="signup-login-prompt">이미 회원이신가요? <Link href="/login">로그인</Link></p>
      </form>
    </section><p className="signup-footer">© 2026 Bulkup Raptor · 안전한 회원가입을 위해 입력 정보는 암호화되어 처리됩니다.</p>
  </div></main>;
}

function formatRemainingTime(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }

function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: ReactNode }) { return <label className="signup-field"><span className="signup-label">{label} {required && <b aria-label="필수">*</b>}</span>{hint && <span className="signup-hint">{hint}</span>}{children}{error && <span className="signup-error" role="alert">{error}</span>}</label>; }

function PasswordInput({ register, name, visible, onToggle, invalid }: { register: UseFormRegister<SignupForm>; name: "password" | "passwordConfirm"; visible: boolean; onToggle: () => void; invalid: boolean }) { return <div className="password-wrap"><input {...register(name)} type={visible ? "text" : "password"} className="signup-input" placeholder={name === "password" ? "영문·숫자 포함 8자 이상" : "비밀번호를 다시 입력해 주세요"} autoComplete="new-password" aria-invalid={invalid} /><button type="button" className="password-toggle" onClick={onToggle} aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}>{visible ? "숨김" : "보기"}</button></div>; }

function PasswordMeter({ password }: { password: string }) { const score = [password.length >= 8, /[A-Za-z]/.test(password), /\d/.test(password)].filter(Boolean).length; if (!password) return null; return <div className="password-meter" aria-live="polite"><div className="meter-bars">{[1, 2, 3].map((bar) => <span key={bar} className={bar <= score ? `active level-${score}` : ""} />)}</div><span>{score < 3 ? "영문과 숫자를 포함해 주세요" : "사용 가능한 비밀번호예요"}</span></div>; }

function ConsentRow({ id, label, register, checked, error }: { id: "termsAgreed" | "privacyAgreed"; label: string; register: UseFormRegister<SignupForm>; checked: boolean; error?: string }) { return <div className="consent-row-wrap"><label className={`consent-row ${checked ? "checked" : ""}`}><input {...register(id)} type="checkbox" /><span className="consent-check" aria-hidden="true">✓</span><span>{label} <b>(필수)</b></span><button type="button" className="consent-detail" onClick={(event) => event.preventDefault()}>보기</button></label>{error && <span className="signup-error consent-error" role="alert">{error}</span>}</div>; }

function SignupComplete() { return <main className="signup-page"><section className="signup-complete" aria-labelledby="complete-title"><div className="complete-icon" aria-hidden="true">✓</div><div className="signup-eyebrow">WELCOME TO BULKUP</div><h1 id="complete-title">회원가입이<br /><span>완료되었습니다.</span></h1><p>가입해 주셔서 감사합니다.<br />이메일 인증까지 완료되어 바로 쇼핑을 시작할 수 있어요.</p><div className="complete-status"><span>현재 회원 상태</span><b>ACTIVE · 이메일 인증 완료</b></div><Link href="/" className="complete-button">쇼핑 시작하기</Link></section></main>; }
