export function fmt(v: number | null | undefined, digits = 1): string | null {
  return v != null ? v.toFixed(digits) : null;
}

export function fmtPrice(v: number | null | undefined): string | null {
  return v != null
    ? `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;
}

// Market cap arrives in crores; lakh-crore is how Indian markets quote large caps.
export function fmtCap(v: number | null | undefined): string | null {
  if (v == null) return null;
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(2)}L Cr`;
  return `₹${Math.round(v).toLocaleString("en-IN")} Cr`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function fmtDate(iso: string | null | undefined): string | null {
  return iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;
}
