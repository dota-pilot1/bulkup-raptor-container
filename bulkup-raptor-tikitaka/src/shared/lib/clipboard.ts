export async function copyToClipboard(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // Tauri WebView는 Clipboard API 객체가 있어도 writeText 권한을 거부할 수 있다.
    // 아래의 사용자 제스처 기반 fallback을 계속 시도한다.
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("CLIPBOARD_UNAVAILABLE");
}
