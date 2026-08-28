import { collection, doc, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AdminAuditLog } from '../types';

const AUDIT_LOGS_STORAGE_KEY = 'gofield_audit_logs';

export async function recordAdminAuditLog(
  log: Omit<AdminAuditLog, 'id' | 'createdAt'>
): Promise<void> {
  const timestamp = new Date().toISOString();
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const fullLog: AdminAuditLog = {
    ...log,
    id: logId,
    createdAt: timestamp,
  };

  // 1. Save to local storage cache immediately
  try {
    const localSaved = localStorage.getItem(AUDIT_LOGS_STORAGE_KEY);
    const logs: AdminAuditLog[] = localSaved ? JSON.parse(localSaved) : [];
    logs.unshift(fullLog);
    // Keep max 200 logs locally
    localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(logs.slice(0, 200)));
  } catch (e) {
    console.warn('Could not save audit log locally', e);
  }

  // 2. Save to Firestore collection 'audit_logs'
  try {
    const logRef = doc(db, 'audit_logs', logId);
    await setDoc(logRef, fullLog);
  } catch (cloudErr) {
    console.warn('Could not write audit log to Firestore (saved locally):', cloudErr);
  }
}

export async function fetchAdminAuditLogs(): Promise<AdminAuditLog[]> {
  try {
    const logsRef = collection(db, 'audit_logs');
    const q = query(logsRef, orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const logs = snapshot.docs.map((d) => d.data() as AdminAuditLog);
      localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(logs));
      return logs;
    }
  } catch (e) {
    console.warn('Error reading audit logs from Firestore, reading local cache', e);
  }

  try {
    const localSaved = localStorage.getItem(AUDIT_LOGS_STORAGE_KEY);
    return localSaved ? JSON.parse(localSaved) : [];
  } catch {
    return [];
  }
}
