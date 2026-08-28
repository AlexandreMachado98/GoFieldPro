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
 * Executes a resilient API request to Asaas with automatic CORS fallback relay
 */
export async function asaasApiRequest(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {},
  config?: SystemBillingConfig
): Promise<Response> {
  const apiKey = config?.asaasApiKey?.trim();
  if (!apiKey) {
    throw new Error('Chave de API do Asaas não informada.');
  }

  const rawBaseUrl = getAsaasBaseUrl(config);
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const targetUrl = `${rawBaseUrl}${cleanEndpoint}`;

  const defaultHeaders: Record<string, string> = {
    'access_token': apiKey,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers: defaultHeaders,
    body: options.body ? JSON.stringify(options.body) : undefined,
  };

  // 1. Try Direct Fetch to Asaas first
  try {
    const directRes = await fetch(targetUrl, fetchOptions);
    return directRes;
  } catch (directErr: any) {
    // 2. Fallback: Secure CORS Bridge Relay
    console.warn('[Asaas] Direct browser CORS blocked, using HTTPS bridge relay...');
    try {
      const relayUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
      const relayRes = await fetch(relayUrl, fetchOptions);
      return relayRes;
    } catch (relayErr) {
      try {
        const altRelayUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        const altRelayRes = await fetch(altRelayUrl, fetchOptions);
        return altRelayRes;
      } catch (finalErr) {
        throw new Error('Erro de conexão (CORS/Rede) ao comunicar com a API do Asaas.');
      }
    }
  }
}

/**
 * Validates Asaas API Key and returns status
 */
export async function testAsaasConnection(
  config?: SystemBillingConfig
): Promise<{ success: boolean; message: string; customerCount?: number }> {
  const apiKey = config?.asaasApiKey?.trim();
  if (!apiKey) {
    return { success: false, message: 'Por favor, insira a Chave de API antes de testar.' };
  }

  try {
    const res = await asaasApiRequest('/customers?limit=1', { method: 'GET' }, config);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: true,
        message: `Conexão Asaas Estabelecida com Sucesso! (Ambiente: ${config?.asaasEnvironment === 'sandbox' ? 'Sandbox' : 'Produção'})`,
        customerCount: data.totalCount || 0,
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      const desc = errData.errors?.[0]?.description || `HTTP ${res.status}: Chave de API inválida ou sem permissão.`;
      return {
        success: false,
        message: `Erro Asaas: ${desc}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Falha ao conectar com o Asaas.',
    };
  }
}

/**
 * Helper to validate basic CPF/CNPJ format before sending to Asaas
 */
function isValidCpfOrCnpj(digits: string): boolean {
  if (!digits || (digits.length !== 11 && digits.length !== 14)) return false;
  // Reject identical digits like 11111111111
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

/**
 * Creates or gets customer in Asaas
 */
export async function getOrCreateAsaasCustomer(
  user: UserProfile,
  config?: SystemBillingConfig
): Promise<{ customerId: string | null; error?: string }> {
  const apiKey = config?.asaasApiKey?.trim();
  if (!apiKey) return { customerId: null, error: 'Chave de API do Asaas não configurada.' };

  try {
    // 1. Search existing customer by email
    const searchRes = await asaasApiRequest(`/customers?email=${encodeURIComponent(user.email)}`, { method: 'GET' }, config);

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.data && data.data.length > 0) {
        return { customerId: data.data[0].id };
      }
    }

    // 2. Create new customer if not found
    const cleanPhone = (user.phone || '').replace(/\D/g, '');
    const cleanCpf = (user.companyCnpj || '').replace(/\D/g, '');
    const hasValidDoc = isValidCpfOrCnpj(cleanCpf);

    const createRes = await asaasApiRequest(
      '/customers',
      {
        method: 'POST',
        body: {
          name: user.name || user.email.split('@')[0] || 'Cliente GoField Pro',
          email: user.email,
          phone: cleanPhone.length >= 10 ? cleanPhone : undefined,
          cpfCnpj: hasValidDoc ? cleanCpf : undefined,
          notificationDisabled: false,
        },
      },
      config
    );

    if (createRes.ok) {
      const created = await createRes.json();
      return { customerId: created.id };
    } else {
      // Fallback: retry with minimal fields
      const retryRes = await asaasApiRequest(
        '/customers',
        {
          method: 'POST',
          body: {
            name: user.name || user.email.split('@')[0] || 'Cliente GoField',
            email: user.email,
            notificationDisabled: true,
          },
        },
        config
      );
      if (retryRes.ok) {
        const retryData = await retryRes.json();
        return { customerId: retryData.id };
      } else {
        const errData = await retryRes.json().catch(() => ({}));
        const desc = errData.errors?.[0]?.description || 'Erro ao cadastrar cliente no Asaas.';
        return { customerId: null, error: desc };
      }
    }
  } catch (err: any) {
    console.warn('Asaas getOrCreateCustomer notice:', err);
    return { customerId: null, error: err.message || 'Falha de conexão com Asaas ao criar cliente.' };
  }
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
  error?: string;
} | null> {
  const apiKey = config?.asaasApiKey?.trim();
  if (!apiKey) return null;

  try {
    const customerResult = await getOrCreateAsaasCustomer(user, config);
    if (!customerResult.customerId) {
      console.warn('Asaas customer creation failed:', customerResult.error);
      return null;
    }

    const customerId = customerResult.customerId;

    // Today + 3 days dueDate
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const payRes = await asaasApiRequest(
      '/payments',
      {
        method: 'POST',
        body: {
          customer: customerId,
          billingType: 'PIX',
          value: Number(value.toFixed(2)),
          dueDate: dueDate,
          description: `Assinatura GoField Pro - ${user.email}`,
          postalService: false,
        },
      },
      config
    );

    if (!payRes.ok) {
      const errJson = await payRes.json().catch(() => ({}));
      console.warn('Asaas create payment error:', errJson);
      return null;
    }

    const payData: AsaasPaymentResponse = await payRes.json();
    const paymentId = payData.id;

    // Fetch PIX QR Code & Copia e Cola payload
    const qrRes = await asaasApiRequest(`/payments/${paymentId}/pixQrCode`, { method: 'GET' }, config);

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

  try {
    const res = await asaasApiRequest(`/payments/${paymentId}`, { method: 'GET' }, config);

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
