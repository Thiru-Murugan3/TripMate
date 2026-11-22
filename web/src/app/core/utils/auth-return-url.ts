/** Keep authentication return paths inside this app. */
export function authReturnUrl(value: unknown): string {
  return typeof value === 'string' && /^\/(?!\/)/.test(value) && !/[\\\u0000-\u0020]/.test(value)
    ? value : '/dashboard';
}
