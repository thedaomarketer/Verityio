/**
 * The file name from a Content-Disposition header, e.g.
 * `attachment; filename="verityio-hours.csv"` (or RFC 5987
 * `filename*=UTF-8''...`). Falls back when the header is missing.
 */
export function fileNameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const extended = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
  if (extended) {
    try {
      return sanitizeFileName(decodeURIComponent(extended[1].trim()), fallback);
    } catch {
      // Malformed percent-encoding: fall through to the plain form.
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/.exec(header);
  return plain ? sanitizeFileName(plain[1].trim(), fallback) : fallback;
}

/** Strips path separators and control characters so a header can't name a path. */
function sanitizeFileName(name: string, fallback: string): string {
  const cleaned = name.replace(/[/\\\u0000-\u001f]/g, "").trim();
  return cleaned || fallback;
}
