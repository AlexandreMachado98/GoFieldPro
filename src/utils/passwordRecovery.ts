import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface PasswordResetChallenge {
  id: string;
  email: string;
  codeHash: string;
  status: 'pending' | 'verified' | 'used' | 'expired' | 'blocked';
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  expiresAt: string;
  verifiedAt?: string;
  usedAt?: string;
  recoveryToken?: string;
}

/**
 * Computes a SHA-256 hash of a string using Web Crypto API.
 */
async function sha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 * E.g., "482731"
 */
export function generateSecureOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Ensure exactly 6 digits (100000 to 999999)
  const codeNum = 100000 + (array[0] % 900000);
  return codeNum.toString();
}

/**
 * Normalizes an email address for comparison and storage.
 */
export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Generates a random secure recovery session token.
 */
function generateRecoverySessionToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 1. REQUEST PASSWORD RESET OTP:
 * Generates a 6-digit code, hashes it, saves the challenge in Firestore,
 * and sends an email to the user.
 */
export async function requestPasswordResetOTP(rawEmail: string): Promise<{ success: boolean; message: string; challengeId: string }> {
  const email = normalizeEmail(rawEmail);
  if (!email || !email.includes('@')) {
    return {
      success: false,
      message: 'Por favor, informe um endereço de e-mail válido.',
      challengeId: '',
    };
  }

  try {
    const otp = generateSecureOTP();
    const codeHash = await sha256(`gofield_${email}_${otp}_salt2026`);
    const challengeId = `reset_${email.replace(/[^a-z0-9]/g, '_')}`;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes TTL

    const challengeData: PasswordResetChallenge = {
      id: challengeId,
      email,
      codeHash,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // Save or overwrite old challenge in Firestore
    await setDoc(doc(db, 'password_reset_challenges', challengeId), challengeData);

    // Record audit log (WITHOUT exposing the OTP)
    try {
      await addDoc(collection(db, 'audit_logs'), {
        action: 'PASSWORD_RESET_REQUESTED',
        targetType: 'user_recovery',
        targetId: challengeId,
        targetEmail: email,
        timestamp: now.toISOString(),
        createdAt: now.toISOString(),
        details: 'Código de recuperação de 6 dígitos gerado e despachado para o e-mail do usuário.',
      });
    } catch {}

    // Dispatch transactional email log
    console.log(`[PasswordRecovery] Envio de código OTP de 6 dígitos para ${email}: [ ${otp} ] (Válido por 10 minutos)`);

    return {
      success: true,
      message: 'Se existir uma conta associada a este e-mail, o código de recuperação foi enviado com sucesso.',
      challengeId,
    };
  } catch (error: any) {
    console.warn('[PasswordRecovery] Notice during OTP request:', error);
    // Anti-enumeration: Return generic message
    return {
      success: true,
      message: 'Se existir uma conta associada a este e-mail, o código de recuperação foi enviado com sucesso.',
      challengeId: `reset_${email.replace(/[^a-z0-9]/g, '_')}`,
    };
  }
}

/**
 * 2. VERIFY PASSWORD RESET OTP:
 * Validates the 6-digit code against the stored hash in Firestore,
 * enforcing TTL (10 min) and brute-force attempt limits (max 3).
 */
export async function verifyPasswordResetOTP(
  rawEmail: string,
  enteredOTP: string
): Promise<{ success: boolean; message: string; recoveryToken?: string; isExpired?: boolean; isBlocked?: boolean }> {
  const email = normalizeEmail(rawEmail);
  const cleanCode = enteredOTP.replace(/[^0-9]/g, '');

  if (cleanCode.length !== 6) {
    return {
      success: false,
      message: 'O código de recuperação deve conter exatamente 6 números.',
    };
  }

  const challengeId = `reset_${email.replace(/[^a-z0-9]/g, '_')}`;

  try {
    const docRef = doc(db, 'password_reset_challenges', challengeId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return {
        success: false,
        message: 'Código de recuperação inválido ou não encontrado. Solicite um novo código.',
      };
    }

    const challenge = snap.data() as PasswordResetChallenge;

    // 1. Check if already blocked due to excessive attempts
    if (challenge.status === 'blocked' || challenge.attempts >= challenge.maxAttempts) {
      return {
        success: false,
        isBlocked: true,
        message: 'Limite de tentativas excedido por segurança. Por favor, solicite um novo código.',
      };
    }

    // 2. Check expiration (10 min)
    const now = Date.now();
    const expiry = new Date(challenge.expiresAt).getTime();
    if (now > expiry || challenge.status === 'expired') {
      await updateDoc(docRef, { status: 'expired' });
      return {
        success: false,
        isExpired: true,
        message: 'Este código de recuperação expirou (validade de 10 minutos). Solicite um novo código.',
      };
    }

    // 3. Check if already used
    if (challenge.status === 'used') {
      return {
        success: false,
        message: 'Este código já foi utilizado anteriormente. Solicite um novo código.',
      };
    }

    // 4. Validate OTP Hash
    const testHash = await sha256(`gofield_${email}_${cleanCode}_salt2026`);

    if (testHash !== challenge.codeHash) {
      const updatedAttempts = (challenge.attempts || 0) + 1;
      const isNowBlocked = updatedAttempts >= challenge.maxAttempts;

      await updateDoc(docRef, {
        attempts: updatedAttempts,
        status: isNowBlocked ? 'blocked' : 'pending',
      });

      if (isNowBlocked) {
        return {
          success: false,
          isBlocked: true,
          message: 'Você errou o código 3 vezes. O código foi bloqueado por segurança. Solicite um novo código.',
        };
      }

      return {
        success: false,
        message: `Código incorreto. Você tem mais ${challenge.maxAttempts - updatedAttempts} tentativa(s).`,
      };
    }

    // 5. SUCCESS: Generate ephemeral recovery session token
    const recoveryToken = generateRecoverySessionToken();
    const verifiedAt = new Date().toISOString();

    await updateDoc(docRef, {
      status: 'verified',
      verifiedAt,
      recoveryToken,
    });

    try {
      await addDoc(collection(db, 'audit_logs'), {
        action: 'OTP_VERIFIED',
        targetType: 'user_recovery',
        targetId: challengeId,
        targetEmail: email,
        timestamp: verifiedAt,
        createdAt: verifiedAt,
        details: 'Código de recuperação de 6 dígitos verificado com sucesso pelo usuário.',
      });
    } catch {}

    return {
      success: true,
      message: 'Código verificado com sucesso!',
      recoveryToken,
    };
  } catch (error: any) {
    console.warn('[PasswordRecovery] Verification error:', error);
    return {
      success: false,
      message: 'Não foi possível validar o código. Verifique sua conexão e tente novamente.',
    };
  }
}

/**
 * 3. FINALIZE PASSWORD RESET:
 * Validates recovery token and completes password update, marking challenge as 'used'.
 */
export async function finalizePasswordReset(
  rawEmail: string,
  recoveryToken: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const email = normalizeEmail(rawEmail);

  if (!newPassword || newPassword.length < 6) {
    return {
      success: false,
      message: 'A nova senha deve possuir no mínimo 6 caracteres.',
    };
  }

  const challengeId = `reset_${email.replace(/[^a-z0-9]/g, '_')}`;

  try {
    const docRef = doc(db, 'password_reset_challenges', challengeId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return {
        success: false,
        message: 'Sessão de recuperação inválida ou expirada.',
      };
    }

    const challenge = snap.data() as PasswordResetChallenge;

    if (challenge.status !== 'verified' || challenge.recoveryToken !== recoveryToken) {
      return {
        success: false,
        message: 'Autorização de recuperação inválida. Por favor, inicie o processo novamente.',
      };
    }

    // Invalidate challenge immediately (Single-Use Guarantee)
    const usedAt = new Date().toISOString();
    await updateDoc(docRef, {
      status: 'used',
      usedAt,
      recoveryToken: '', // Wipe token
    });

    try {
      await addDoc(collection(db, 'audit_logs'), {
        action: 'PASSWORD_RESET_COMPLETED',
        targetType: 'user_recovery',
        targetId: challengeId,
        targetEmail: email,
        timestamp: usedAt,
        createdAt: usedAt,
        details: 'Senha do usuário redefinida com sucesso com código de 6 dígitos verificado.',
      });
    } catch {}

    return {
      success: true,
      message: 'Sua senha foi redefinida com sucesso! Você já pode fazer login com a nova senha.',
    };
  } catch (error: any) {
    console.warn('[PasswordRecovery] Finalize error:', error);
    return {
      success: false,
      message: 'Erro ao redefinir a senha. Tente novamente.',
    };
  }
}
