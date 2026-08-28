/**
 * User-Scoped Storage Utility
 * Isolates all local browser storage per authenticated User ID (UID)
 * to prevent cross-account data leakage on shared devices.
 */

const LEGACY_UNSCOPED_KEYS = [
  'geofield_layers',
  'geofield_projects',
  'geofield_waypoints',
  'geofield_savedTracks',
  'geofield_field_rounds',
  'geofield_fire_incidents',
  'gofield_woodpiles',
  'gofield_custom_company_logo',
  'gofield_custom_company_name',
  'gofield_custom_company_cnpj',
  'geofield_pdf_maps_v2',
  'geofield_selected_pdf_id',
  'geofield_manual_gps_locked',
  'geofield_manual_gps_coord',
  'gofield_app_settings',
];

/**
 * Builds a user-scoped storage key
 */
export function getUserStorageKey(userId: string, key: string): string {
  if (!userId) {
    console.warn(`[userStorage] Empty userId provided for key '${key}'. Defaulting to 'anonymous'`);
    return `gofield_anon_${key}`;
  }
  return `gofield_user_${userId}_${key}`;
}

/**
 * Gets a parsed item from user-scoped localStorage
 */
export function getUserItem<T>(userId: string | undefined | null, key: string, defaultValue: T): T {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return defaultValue;
  }
  try {
    const scopedKey = getUserStorageKey(userId, key);
    const raw = localStorage.getItem(scopedKey);
    if (raw === null || raw === undefined) {
      return defaultValue;
    }
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`[userStorage] Error reading key '${key}' for user '${userId}':`, e);
    return defaultValue;
  }
}

/**
 * Gets a raw string from user-scoped localStorage
 */
export function getUserRawItem(userId: string | undefined | null, key: string, defaultValue: string = ''): string {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return defaultValue;
  }
  try {
    const scopedKey = getUserStorageKey(userId, key);
    const raw = localStorage.getItem(scopedKey);
    return raw !== null && raw !== undefined ? raw : defaultValue;
  } catch (e) {
    console.warn(`[userStorage] Error reading raw key '${key}' for user '${userId}':`, e);
    return defaultValue;
  }
}

/**
 * Sets a value in user-scoped localStorage
 */
export function setUserItem(userId: string | undefined | null, key: string, value: any): void {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const scopedKey = getUserStorageKey(userId, key);
    if (typeof value === 'string') {
      localStorage.setItem(scopedKey, value);
    } else {
      localStorage.setItem(scopedKey, JSON.stringify(value));
    }
  } catch (e) {
    console.warn(`[userStorage] Error setting key '${key}' for user '${userId}':`, e);
  }
}

/**
 * Removes an item from user-scoped localStorage
 */
export function removeUserItem(userId: string | undefined | null, key: string): void {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const scopedKey = getUserStorageKey(userId, key);
    localStorage.removeItem(scopedKey);
  } catch (e) {
    console.warn(`[userStorage] Error removing key '${key}' for user '${userId}':`, e);
  }
}

/**
 * Purges old global legacy keys that were not partitioned by userId,
 * ensuring no stale data leaks into new accounts.
 */
export function purgeLegacyUnscopedData(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    for (const key of LEGACY_UNSCOPED_KEYS) {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.warn('[userStorage] Error purging legacy unscoped data:', e);
  }
}

/**
 * Clears all local data belonging to a specific user UID
 */
export function clearUserData(userId: string): void {
  if (!userId || typeof window === 'undefined' || !window.localStorage) return;
  try {
    const prefix = `gofield_user_${userId}_`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch (e) {
    console.warn(`[userStorage] Error clearing user data for '${userId}':`, e);
  }
}
