export function apiError(code: string, message: string) {
  return { success: false, error: { code, message } };
}

export function apiSuccess(payload: any = {}) {
  return { success: true, ...payload };
}
