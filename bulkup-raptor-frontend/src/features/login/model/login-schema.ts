import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("올바른 이메일을 입력해 주세요.").max(254, "이메일은 254자 이하로 입력해 주세요."),
  password: z.string().min(1, "비밀번호를 입력해 주세요.").max(72, "비밀번호는 72자 이하로 입력해 주세요."),
});

export type LoginForm = z.infer<typeof loginSchema>;

