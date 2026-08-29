import { adminDb } from './_lib/firebaseAdmin';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, asaas-access-token, access_token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Enforce POST method
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  // 2. Validate Asaas Webhook Security Token
  const configuredSecret = process.env.ASAAS_WEBHOOK_SECRET?.trim();
  const receivedToken = (req.headers['asaas-access-token'] || req.headers['access_token'] || '') as string;

  if (configuredSecret && receivedToken !== configuredSecret) {
    console.warn('[WEBHOOK_AUTH_FAILED] Token de webhook inválido recebido.');
    return res.status(401).json({ error: 'UNAUTHORIZED: Token de webhook inválido.' });
  }

  const { event, payment } = req.body || {};

  if (!event || !payment) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD: Evento ou dados do pagamento ausentes.' });
  }

  const eventId = (req.body.id || `${payment.id}_${event}`) as string;

  try {
    // 3. Idempotency Check & Atomic Event Registration
    const eventRef = adminDb.collection('processed_webhook_events').doc(eventId);
    const existingDoc = await eventRef.get();

    if (existingDoc.exists) {
      // Event was already safely processed -> avoid duplicate processing
      return res.status(200).json({ received: true, status: 'already_processed', eventId });
    }

    // Save event record
    await eventRef.set({
      eventId,
      event,
      paymentId: payment.id,
      value: payment.value,
      billingType: payment.billingType,
      status: payment.status,
      externalReference: payment.externalReference || null,
      receivedAt: new Date().toISOString(),
    });

    // 4. Resolve Target User UID
    let targetUid: string | null = payment.externalReference || null;

    if (!targetUid && payment.customer) {
      // Fallback: lookup user by email from customer details if externalReference was omitted
      const userSnap = await adminDb
        .collection('users')
        .where('email', '==', payment.customer.email?.toLowerCase())
        .limit(1)
        .get();

      if (!userSnap.empty) {
        targetUid = userSnap.docs[0].id;
      }
    }

    if (!targetUid) {
      console.warn(`[WEBHOOK_NOTICE] Pagamento ${payment.id} recebido sem vínculo de UID direto.`);
      return res.status(200).json({ received: true, notice: 'user_not_found', eventId });
    }

    const userDocRef = adminDb.collection('users').doc(targetUid);

    // 5. Handle Payment Status Events
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const now = new Date();
      // Annual plan grant: 365 days
      const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

      await userDocRef.update({
        subscriptionPlan: 'pro',
        subscriptionStatus: 'active',
        subscriptionExpiresAt: expiresAt,
        lastPaymentDate: now.toISOString(),
        subscriptionValue: payment.value || 99.98,
        paymentMethod: payment.billingType?.toLowerCase() || 'pix',
        updatedAt: now.toISOString(),
      });

      // Write immutable audit log
      await adminDb.collection('audit_payment_logs').add({
        uid: targetUid,
        paymentId: payment.id,
        event,
        amount: payment.value,
        status: 'active',
        expiresAt,
        timestamp: now.toISOString(),
        source: 'asaas_webhook',
      });

      console.log(`[WEBHOOK_SUCCESS] Assinatura Pro ativada com sucesso para usuário: ${targetUid}`);
    } else if (event === 'PAYMENT_OVERDUE') {
      await userDocRef.update({
        subscriptionStatus: 'overdue',
        updatedAt: new Date().toISOString(),
      });
    } else if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_DELETED') {
      await userDocRef.update({
        subscriptionStatus: 'canceled',
        updatedAt: new Date().toISOString(),
      });
    }

    return res.status(200).json({ received: true, success: true, eventId, uid: targetUid });
  } catch (err: any) {
    console.error('[WEBHOOK_PROCESSING_ERROR]', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
}
