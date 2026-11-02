import { apiFetch } from "@/shared/api/client";

export type ProfileImageResponse = { profileImageUrl: string };

export function updateProfileImage(key: string) {
  return apiFetch<ProfileImageResponse>("/api/auth/me/profile-image", {
    method: "PATCH",
    body: JSON.stringify({ key }),
  });
}
