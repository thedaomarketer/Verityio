/**
 * A text field from submitted FormData, or `undefined` when the control
 * wasn't submitted. Browsers omit disabled controls and ones that weren't
 * rendered (e.g. the City select when a province has no city taxes, or the
 * Job select for someone with no jobs yet). `formData.get` returns `null`
 * for those, which an `.optional()` schema rejects -- so optional fields
 * must be read through this.
 */
export function formText(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}
