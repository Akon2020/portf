/** Normalizes a phone number to E.164 digits, +243 (DRC) by default for local numbers. */
export function normalizePhone(input: string, defaultCountry = "243"): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+")) {
    // Already international.
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = defaultCountry + digits.slice(1);
  } else if (digits.length <= 9) {
    digits = defaultCountry + digits;
  }
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

/** wa.me link with a prefilled message. Returns null for an invalid number. */
export function whatsappLink(phone: string, message?: string): string | null {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}
