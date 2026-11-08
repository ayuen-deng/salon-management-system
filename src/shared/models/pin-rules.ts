export function validateStaffUsername(value: string): string | null {
  const username = value.trim().toLowerCase();
  return /^[a-z0-9._]{3,20}$/.test(username) ? username : null;
}

export function isStrongTemporaryPin(pin: string, _phone: string, temporaryPin?: string): boolean {
  // Salon staff use memorable six-digit PINs. Keep only format validation;
  // when changing a temporary PIN, require it to differ from the issued PIN.
  return /^\d{6}$/.test(pin) && (!temporaryPin || pin !== temporaryPin);
}
