/** 로그인 후에는 같은 앱의 화면으로만 이동하고 로그인 화면 반복을 막는다. */
export function getLoginReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || /[\\\x00-\x20]/.test(value)) return "/";
  try {
    const base = "http://local.invalid";
    const url = new URL(value, base);
    const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, "");
    if (url.origin !== base || pathname === "/login") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
