/** Password form rules, shared by reset and change-password screens. The backend owns real password policy. */
export const MIN_PASSWORD = 8;

export function validateNewPassword(password: string, confirm: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (password.length < MIN_PASSWORD) errors.password = `Use at least ${MIN_PASSWORD} characters.`;
  else if (password.length > 200) errors.password = "Keep it under 200 characters.";
  if (confirm !== password) errors.confirm = "The passwords don't match.";
  return errors;
}
