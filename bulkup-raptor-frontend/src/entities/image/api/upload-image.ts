import { apiFetch } from "@/shared/api/client";

export type UploadedImage = {
  key: string;
  url: string;
  contentType: string;
  size: number;
  width: number;
  height: number;
};

export function uploadImage(file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<UploadedImage>("/api/images", { method: "POST", body });
}
