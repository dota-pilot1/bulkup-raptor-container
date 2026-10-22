// Tauri 전용 S3 업로드 — 웹 프론트의 apiRequest(fetch/토큰자동주입)와 달리
// tauri는 apiRequest(객체 body + token 명시) + plugin-http fetch(CORS 우회)를 쓴다.
import { request, safeFetch } from "../../../api/client";

type PresignedUrlResponse = {
  presignedUrl: string;
  publicUrl: string;
  key: string;
};

function assertPresignResponse(
  response: Partial<PresignedUrlResponse>,
): asserts response is PresignedUrlResponse {
  if (
    typeof response.presignedUrl !== "string" ||
    response.presignedUrl.length === 0
  ) {
    throw new Error(
      "Upload presign response is invalid: presignedUrl is missing.",
    );
  }

  if (typeof response.publicUrl !== "string" || response.publicUrl.length === 0) {
    throw new Error("Upload presign response is invalid: publicUrl is missing.");
  }
}

export async function uploadImageToS3(file: File): Promise<string> {
  const response = await request<Partial<PresignedUrlResponse>>("/api/upload/presign", {
    method: "POST",
    body: { filename: file.name, contentType: file.type, folder: "dev-study" },
  });
  assertPresignResponse(response);

  const { presignedUrl, publicUrl } = response;

  // 프리사인 URL 직접 업로드
  const putResponse = await safeFetch(presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!putResponse.ok) {
    throw new Error(`S3 upload failed: ${putResponse.status}`);
  }

  return publicUrl;
}

