export async function uploadImageToS3(file: File): Promise<string> {
  // Fullstack 로컬 런타임에는 S3 presign API가 없으므로 우선 세션 내
  // 미리보기를 제공한다. 업로드 API가 연결되면 이 어댑터만 교체한다.
  return URL.createObjectURL(file);
}
