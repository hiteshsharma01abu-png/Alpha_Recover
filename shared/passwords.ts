/** Password rules shared by the register/reset forms and the API (docs/SECURITY.md §1). */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// The most common leaked passwords (lower-cased). Not exhaustive: it blocks the obvious ones without a
// network call. Length matters more than composition rules (NIST 800-63B).
const COMMON = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'password123', 'qwerty123', 'qwertyuiop',
  '11111111', '00000000', '87654321', 'iloveyou', 'sunshine', 'princess', 'football', 'baseball', 'welcome1',
  'welcome123', 'abc12345', 'abcd1234', 'admin123', 'letmein1', 'monkey123', 'dragon123', 'trustno1',
  'passw0rd', 'p@ssw0rd', 'p@ssword', 'india123', 'india@123', 'qwerty12', '1q2w3e4r', '1qaz2wsx', 'zaq12wsx',
  'asdfghjk', 'asdf1234', 'master123', 'superman', 'computer', 'changeme', 'whatever', 'internet', 'samsung1',
  '12341234', '123123123', '987654321', 'alpharecover', 'alpha123', 'recover123', 'datarecovery',
]);

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters`;
  if (COMMON.has(password.toLowerCase())) return 'This password is too common. Choose a less predictable one';
  return null;
}
