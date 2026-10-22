"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "../api/login";
import type { LoginForm } from "./login-schema";

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: LoginForm) => login({
      email: values.email.trim().toLowerCase(),
      password: values.password,
    }),
    onSuccess: (member) => {
      queryClient.setQueryData(["me"], member);
    },
  });
}
