export interface AsaasCustomerPayload {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  mobilePhone?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

export interface AsaasPaymentPayload {
  customer: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';
  value: number;
  dueDate: string;
  description: string;
  externalReference?: string;
  postalService?: boolean;
}

export function getAsaasBaseUrl(): string {
  const env = process.env.ASAAS_ENVIRONMENT || 'production';
  return env === 'sandbox'
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/v3';
}

export async function asaasServerRequest(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<Response> {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('CONFIG_ERROR: Chave ASAAS_API_KEY não configurada no servidor.');
  }

  const baseUrl = getAsaasBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
      'User-Agent': 'AM-TST-GoFieldPro-Server/2.6',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return res;
}

/**
 * Searches for customer by email or creates a new customer record securely
 */
export async function getOrCreateAsaasCustomerServer(
  user: { uid: string; email: string; name: string; cpfCnpj?: string; phone?: string }
): Promise<{ customerId: string }> {
  // 1. Search existing customer by email
  const searchRes = await asaasServerRequest(`/customers?email=${encodeURIComponent(user.email)}`, {
    method: 'GET',
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.data && searchData.data.length > 0) {
      return { customerId: searchData.data[0].id };
    }
  }

  // 2. Create customer if not found
  const payload: AsaasCustomerPayload = {
    name: user.name?.trim() || user.email.split('@')[0],
    email: user.email.trim().toLowerCase(),
    cpfCnpj: user.cpfCnpj?.replace(/\D/g, '') || undefined,
    mobilePhone: user.phone?.replace(/\D/g, '') || undefined,
    externalReference: user.uid,
    notificationDisabled: false,
  };

  const createRes = await asaasServerRequest('/customers', {
    method: 'POST',
    body: payload,
  });

  if (!createRes.ok) {
    const errJson = await createRes.json().catch(() => ({}));
    const desc = errJson.errors?.[0]?.description || 'Erro ao cadastrar cliente no Asaas.';
    throw new Error(`ASAAS_CUSTOMER_ERROR: ${desc}`);
  }

  const createdData = await createRes.json();
  return { customerId: createdData.id };
}

/**
 * Creates an instant PIX payment with strict server-side pricing
 */
export async function createAsaasPixChargeServer(params: {
  customerId: string;
  uid: string;
  value: number;
  description: string;
  daysToDueDate?: number;
}): Promise<{
  paymentId: string;
  value: number;
  dueDate: string;
  invoiceUrl?: string;
  pixQrCode?: string;
  pixPayload?: string;
  expirationDate?: string;
}> {
  const due = new Date();
  due.setDate(due.getDate() + (params.daysToDueDate || 3));
  const dueDateStr = due.toISOString().split('T')[0];

  const payRes = await asaasServerRequest('/payments', {
    method: 'POST',
    body: {
      customer: params.customerId,
      billingType: 'PIX',
      value: params.value,
      dueDate: dueDateStr,
      description: params.description,
      externalReference: params.uid,
      postalService: false,
    },
  });

  if (!payRes.ok) {
    const errJson = await payRes.json().catch(() => ({}));
    const desc = errJson.errors?.[0]?.description || 'Erro ao criar cobrança no Asaas.';
    throw new Error(`ASAAS_PAYMENT_ERROR: ${desc}`);
  }

  const payData = await payRes.json();
  const paymentId = payData.id;

  // Retrieve PIX QR Code & Copia-e-Cola payload
  const qrRes = await asaasServerRequest(`/payments/${paymentId}/pixQrCode`, { method: 'GET' });
  let pixQrCode = '';
  let pixPayload = '';
  let expirationDate = '';

  if (qrRes.ok) {
    const qrData = await qrRes.json();
    pixQrCode = qrData.encodedImage ? `data:image/png;base64,${qrData.encodedImage}` : '';
    pixPayload = qrData.payload || '';
    expirationDate = qrData.expirationDate || '';
  }

  return {
    paymentId,
    value: payData.value,
    dueDate: payData.dueDate,
    invoiceUrl: payData.invoiceUrl || payData.bankSlipUrl,
    pixQrCode,
    pixPayload,
    expirationDate,
  };
}
