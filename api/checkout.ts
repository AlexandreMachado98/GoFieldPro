import { getOrCreateAsaasCustomerServer, createAsaasPixChargeServer } from './_lib/asaas';

// Official authoritative pricing matrix (enforced server-side)
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

export default async function handler(req: any, res: any) {
  // 1. Enforce POST method
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED: Utilize POST.' });
  }

  try {
    const { uid, email, name, cpfCnpj, phone, planId = 'pro_anual' } = req.body || {};

    // 2. Strict Input Validation
    if (!uid || typeof uid !== 'string' || uid.length < 5) {
      return res.status(400).json({ error: 'INVALID_INPUT: UID do usuário é obrigatório.' });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'INVALID_INPUT: E-mail válido é obrigatório.' });
    }

    // 3. Authoritative Plan and Price Resolution
    const officialPlan = AUTHORITATIVE_PLANS[planId];
    if (!officialPlan) {
      return res.status(400).json({
        error: `INVALID_PLAN: O plano '${planId}' não existe ou não está disponível para contratação.`,
      });
    }

    // 4. Create/Get Asaas Customer
    const { customerId } = await getOrCreateAsaasCustomerServer({
      uid: uid.trim(),
      email: email.trim().toLowerCase(),
      name: (name || email.split('@')[0]).trim(),
      cpfCnpj,
      phone,
    });

    // 5. Create Asaas PIX Charge with forced official price
    const charge = await createAsaasPixChargeServer({
      customerId,
      uid: uid.trim(),
      value: officialPlan.price,
      description: `Assinatura ${officialPlan.name} • AM TST`,
      daysToDueDate: 3,
    });

    // 6. Return sanitized payment info
    return res.status(200).json({
      success: true,
      plan: {
        id: planId,
        name: officialPlan.name,
        price: officialPlan.price,
      },
      payment: {
        id: charge.paymentId,
        value: charge.value,
        dueDate: charge.dueDate,
        invoiceUrl: charge.invoiceUrl,
        pixQrCode: charge.pixQrCode,
        pixPayload: charge.pixPayload,
        expirationDate: charge.expirationDate,
      },
    });
  } catch (err: any) {
    console.error('[API_CHECKOUT_ERROR]', err);
    return res.status(500).json({
      error: 'PAYMENT_GATEWAY_ERROR',
      message: err.message || 'Falha ao processar solicitação de pagamento com o Asaas.',
    });
  }
}
