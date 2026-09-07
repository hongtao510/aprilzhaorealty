/**
 * Return an application-local redirect target.
 *
 * Reject protocol-relative URLs, backslashes, control characters, and URL
 * schemes. The returned value always resolves to the fixed validation origin.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) {
    return fallback;
  }

  try {
    const validationOrigin = "https://aprilzhaohome.invalid";
    const parsed = new URL(value, validationOrigin);
    if (parsed.origin !== validationOrigin) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
