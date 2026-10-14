// Normalize the standard ETA format; custom business-authored text remains untouched.
export function localizedDeliveryEta(eta: string | undefined, bn: boolean) {
  if (!eta || !bn) return eta
  return eta
    .replace(/(\d+)\s*[–-]\s*(\d+)\s+business days?/gi, '$1–$2 কর্মদিবস')
    .replace(/(\d+)\s+business days?/gi, '$1 কর্মদিবস')
}
