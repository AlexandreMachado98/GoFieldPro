import { SystemBillingConfig, UserProfile } from '../types';

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
}

export interface AsaasPaymentResponse {
  id: string;
  customer: string;
  value: number;
  netValue: number;
  billingType: string;
  status: string; // 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE'
  dueDate: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixTransaction?: {
    encodedImage: string;
    payload: string;
    expirationDate: string;
  };
}

export interface AsaasPixQrCodeResponse {
  encodedImage: string; // Base64 PNG image
  payload: string; // Pix Copia e Cola
  expirationDate: string;
}

/**
 * Returns base URL for Asaas API depending on environment
 */
export function getAsaasBaseUrl(config?: SystemBillingConfig): string {
  const env = config?.asaasEnvironment || 'production';
  return env === 'sandbox'
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/api/v3';
}

/**
 * Creates or gets customer in Asaas
 */
export async function getOrCreateAsaasCustomer(
  user: UserProfile,
  config?: SystemBillingConfig
): Promise<string | null> {
  const apiKey = config?.asaasApiKey?.trim();
  if (!apiKey) return null;

  const baseUrl = getAsaasBaseUrl(config);

  try {
    // 1. Search existing customer by email
    const searchRes = await fetch(`${baseUrl}/customers?email=${encodeURIComponent(user.email)}`, {
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.data && data.data.length > 0) {
        return data.data[0].id;
      }
    }

    // 2. Create new customer if not found
    const cleanPhone = (user.phone || '').replace(/\D/g, '');
    const cleanCpf = (user.companyCnpj || '').replace(/\D/g, '');

    const createRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: user.name || user.email.split('@')[0],
        email: user.email,
        phone: cleanPhone.length >= 10 ? cleanPhone : undefined,
        cpfCnpj: cleanCpf.length >= 11 ? cleanCpf : undefined,
        notificationDisabled: false,
      }),
    });

    if (createRes.ok) {
      const created = await createRes.json();
      return created.id;
    }
  } catch (err) {
    console.warn('Asaas getOrCreateCustomer notice:', err);
  }

  return null;
}

/**
 * Generates an instant PIX payment charge via Asaas API
 */
export async function createAsaasPixPayment(
  user: UserProfile,
  value: number,
  config?: SystemBillingConfig
): Promise<{
  paymentId: string;
  pixPayload: string;
  pixQrCodeBase64: string;
  invoiceUrl?: string;
} | null> {
  const apiKey = config?.asaasApiKey?.trim();
  if (!apiKey) return null;

  const baseUrl = getAsaasBaseUrl(config);

  try {
    const customerId = await getOrCreateAsaasCustomer(user, config);
    if (!customerId) return null;

    // Today + 3 days dueDate
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const payRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: Number(value.toFixed(2)),
        dueDate: dueDate,
        description: `Assinatura GoField Pro - ${user.email}`,
        postalService: false,
      }),
    });

    if (!payRes.ok) {
      const errJson = await payRes.json();
      console.warn('Asaas create payment error:', errJson);
      return null;
    }

    const payData: AsaasPaymentResponse = await payRes.json();
    const paymentId = payData.id;

    // Fetch PIX QR Code & Copia e Cola payload
    const qrRes = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, {
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (qrRes.ok) {
      const qrData: AsaasPixQrCodeResponse = await qrRes.json();
      return {
        paymentId,
        pixPayload: qrData.payload,
        pixQrCodeBase64: qrData.encodedImage,
        invoiceUrl: payData.invoiceUrl,
      };
    }
  } catch (err) {
    console.error('Error creating Asaas PIX payment:', err);
  }

  return null;
}

/**
 * Checks status of an Asaas payment (returns true if confirmed or received)
 */
export async function checkAsaasPaymentStatus(
  paymentId: string,
  config?: SystemBillingConfig
): Promise<'RECEIVED' | 'CONFIRMED' | 'PENDING' | 'OVERDUE' | 'ERROR'> {
  const apiKey = config?.asaasApiKey?.trim();
  if (!apiKey || !paymentId) return 'ERROR';

  const baseUrl = getAsaasBaseUrl(config);

  try {
    const res = await fetch(`${baseUrl}/payments/${paymentId}`, {
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) {
      const data: AsaasPaymentResponse = await res.json();
      if (data.status === 'RECEIVED' || data.status === 'CONFIRMED') {
        return 'CONFIRMED';
      }
      if (data.status === 'PENDING') {
        return 'PENDING';
      }
      return data.status as any;
    }
  } catch (err) {
    console.warn('Error checking Asaas payment status:', err);
  }

  return 'PENDING';
}
