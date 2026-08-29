// Autoritative Plans & Prices (enforced server-side)
const AUTHORITATIVE_PLANS: Record<string, { name: string; price: number; durationDays: number }> = {
  pro_anual: {
    name: 'GoField Pro — Plano Anual',
    price: 99.98,
    durationDays: 365,
  },
  pro: {
    name: 'GoField Pro — Plano Anual',
    price: 99.98,
    durationDays: 365,
  },
};

function getAsaasBaseUrl(): string {
  const env = process.env.ASAAS_ENVIRONMENT || 'production';
  return env === 'sandbox'
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/v3';
}

async function asaasServerRequest(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<Response> {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('A chave de API do Asaas (ASAAS_API_KEY) ainda não foi cadastrada na Vercel.');
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

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, asaas-access-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED: Utilize POST.' });
  }

  try {
    let parsedBody = req.body;
    if (typeof parsedBody === 'string') {
      try {
        parsedBody = JSON.parse(parsedBody);
      } catch (e) {
        parsedBody = {};
      }
    }

    const { uid, email, name, cpfCnpj, phone, planId = 'pro_anual' } = parsedBody || {};

    if (!uid || typeof uid !== 'string' || uid.length < 3) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'E-mail ou UID do usuário é obrigatório.' });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'E-mail válido é obrigatório.' });
    }

    const officialPlan = AUTHORITATIVE_PLANS[planId];
    if (!officialPlan) {
      return res.status(400).json({
        error: 'INVALID_PLAN',
        message: `O plano '${planId}' não existe ou não está disponível.`,
      });
    }

    // 1. Search or Create Asaas Customer
    let customerId = '';
    const cleanEmail = email.trim().toLowerCase();
    const searchRes = await asaasServerRequest(`/customers?email=${encodeURIComponent(cleanEmail)}`, {
      method: 'GET',
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
      }
    }

    if (!customerId) {
      const createRes = await asaasServerRequest('/customers', {
        method: 'POST',
        body: {
          name: (name || cleanEmail.split('@')[0]).trim(),
          email: cleanEmail,
          cpfCnpj: cpfCnpj ? String(cpfCnpj).replace(/\D/g, '') : undefined,
          mobilePhone: phone ? String(phone).replace(/\D/g, '') : undefined,
          externalReference: uid,
          notificationDisabled: false,
        },
      });

      if (!createRes.ok) {
        const errJson = await createRes.json().catch(() => ({}));
        const desc = errJson.errors?.[0]?.description || 'Erro ao cadastrar cliente no Asaas.';
        return res.status(400).json({ error: 'ASAAS_CUSTOMER_ERROR', message: desc });
      }

      const createdData = await createRes.json();
      customerId = createdData.id;
    }

    // 2. Create Asaas PIX Payment
    const due = new Date();
    due.setDate(due.getDate() + 3);
    const dueDateStr = due.toISOString().split('T')[0];

    const payRes = await asaasServerRequest('/payments', {
      method: 'POST',
      body: {
        customer: customerId,
        billingType: 'PIX',
        value: officialPlan.price,
        dueDate: dueDateStr,
        description: `Assinatura ${officialPlan.name} • AM TST`,
        externalReference: uid,
        postalService: false,
      },
    });

    if (!payRes.ok) {
      const errJson = await payRes.json().catch(() => ({}));
      const desc = errJson.errors?.[0]?.description || 'Erro ao gerar cobrança no Asaas.';
      return res.status(400).json({ error: 'ASAAS_PAYMENT_ERROR', message: desc });
    }

    const payData = await payRes.json();
    const paymentId = payData.id;

    // 3. Retrieve PIX QR Code & Copia e Cola
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

    return res.status(200).json({
      success: true,
      plan: {
        id: planId,
        name: officialPlan.name,
        price: officialPlan.price,
      },
      payment: {
        id: paymentId,
        value: payData.value,
        dueDate: payData.dueDate,
        invoiceUrl: payData.invoiceUrl || payData.bankSlipUrl,
        pixQrCode,
        pixPayload,
        expirationDate,
      },
    });
  } catch (err: any) {
    console.error('[API_CHECKOUT_ERROR]', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: err.message || 'Falha ao processar checkout.',
    });
  }
}
