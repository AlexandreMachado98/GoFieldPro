/**
 * Recursively cleans and removes any undefined fields from objects or arrays
 * ensuring 100% compatibility with Cloud Firestore requirements.
 */
export function sanitizeFirestorePayload<T>(input: T): T {
  if (input === undefined) {
    return null as any;
  }
  if (input === null || typeof input !== 'object') {
    return input;
  }
  if (input instanceof Date) {
    return input.toISOString() as any;
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeFirestorePayload(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      result[key] = sanitizeFirestorePayload(value);
    }
  }
  return result as T;
}
