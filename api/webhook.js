import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const apps = getApps();
const app = apps.length
  ? apps[0]
  : (() => {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'gofield-pro';
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined;

      if (clientEmail && privateKey) {
        return initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      }

      return initializeApp({ projectId });
    })();

const adminDb = getFirestore(app);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, asaas-access-token, access_token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const configuredSecret = (process.env.ASAAS_WEBHOOK_SECRET || '').trim();
  const receivedToken = (req.headers['asaas-access-token'] || req.headers['access_token'] || '') ;

  if (configuredSecret && receivedToken !== configuredSecret) {
    console.warn('[WEBHOOK_AUTH_FAILED] Token de webhook inválido recebido.');
    return res.status(401).json({ error: 'UNAUTHORIZED: Token de webhook inválido.' });
  }

  let parsedBody = req.body;
  if (typeof parsedBody === 'string') {
    try {
      parsedBody = JSON.parse(parsedBody);
    } catch (e) {
      parsedBody = {};
    }
  }

  const { event, payment } = parsedBody || {};

  if (!event || !payment) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD: Evento ou dados do pagamento ausentes.' });
  }

  const eventId = (parsedBody.id || `${payment.id}_${event}`);

  try {
    const eventRef = adminDb.collection('processed_webhook_events').doc(eventId);
    const existingDoc = await eventRef.get();

    if (existingDoc.exists) {
      return res.status(200).json({ received: true, status: 'already_processed', eventId });
    }

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

    let targetUid = payment.externalReference || null;

    if (!targetUid && payment.customer) {
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

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

      await userDocRef.update({
        subscriptionPlan: 'pro',
        subscriptionStatus: 'active',
        subscriptionExpiresAt: expiresAt,
        lastPaymentDate: now.toISOString(),
        subscriptionValue: payment.value || 99.98,
        paymentMethod: (payment.billingType || 'pix').toLowerCase(),
        updatedAt: now.toISOString(),
      });

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

      console.log(`[WEBHOOK_SUCCESS] Assinatura Pro ativada para usuário: ${targetUid}`);
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
  } catch (err) {
    console.error('[WEBHOOK_PROCESSING_ERROR]', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
}
