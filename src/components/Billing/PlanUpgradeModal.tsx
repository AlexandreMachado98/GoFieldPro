import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Crown,
  Sparkles,
  Check,
  Zap,
  QrCode,
  Copy,
  CheckCircle2,
  Lock,
  Flame,
  Trees,
  HardDrive,
  FileText,
  Clock,
  ShieldCheck,
  ArrowRight,
  Loader2,
  RefreshCw,
  Star,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { createAsaasPixPayment, checkAsaasPaymentStatus } from '../../utils/asaasGateway';
import { PlanItemConfig } from '../../types';

const FALLBACK_PLANS: PlanItemConfig[] = [
  {
    id: 'pro',
    name: 'Plano Profissional',
    tag: 'Individual',
    originalPrice: 97.99,
    price: 44.99,
    discountBadge: '54% OFF • LANÇAMENTO',
    billingPeriod: '/mês',
    features: [
      'Mapas PDF e GPS Ilimitados',
      'Medição de Pilha de Madeira (m³)',
      'Mapas Satélite Offline',
      'Exportação KML, KMZ & GPX',
      'Laudos Periciais em PDF com Fotos',
      'Rondas & Odômetro Ilimitados',
    ],
    highlight: true,
    activeInShowcase: true,
  },
  {
    id: 'equipe',
    name: 'Plano Equipe Topografia',
    tag: 'Mais Popular',
    originalPrice: 390.00,
    price: 289.00,
    discountBadge: 'Economize R$ 101/mês',
    billingPeriod: '/mês',
    features: [
      'Até 5 Técnicos de Campo',
      'Painel de Gestão da Frota & Odômetro',
      'Cubagem Florestal e Laudos em Lote',
      'Backup e Sincronização em Nuvem',
      'Exportação Ilimitada em Alta Resolução',
    ],
    highlight: false,
    activeInShowcase: true,
  },
  {
    id: 'florestal',
    name: 'Florestal & Usinas',
    tag: 'Corporativo',
    originalPrice: 950.00,
    price: 690.00,
    discountBadge: '27% OFF',
    billingPeriod: '/mês',
    features: [
      '15 a 30 Operadores simultâneos',
      'Logotipo da Empresa nos Laudos PDF',
      'Contratos e Faturamento PJ',
      'Treinamento e Suporte VIP Prioritário',
      'Backup Dedicado e SLA Garantido',
    ],
    highlight: false,
    activeInShowcase: true,
  },
];

export const PlanUpgradeModal: React.FC = () => {
  const {
    isUpgradeModalOpen,
    setIsUpgradeModalOpen,
    upgradeModalFeature,
    billingConfig,
    isProUser,
    notifySuccess,
    notifyInfo,
    notifyWarning,
    notifyError,
  } = useApp();
  const { profile, refreshProfile } = useAuth();

  const [paymentStep, setPaymentStep] = useState<'showcase' | 'pix_checkout' | 'success'>('showcase');
  const [isGeneratingPix, setIsGeneratingPix] = useState<boolean>(false);
  const [pixPayload, setPixPayload] = useState<string>('');
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState<string>('');
  const [paymentId, setPaymentId] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState<boolean>(false);

  // Active showcase plans strictly filtered by Admin configuration
  const availablePlans = useMemo(() => {
    let rawPlans: PlanItemConfig[] = [];

    if (billingConfig?.plans && Array.isArray(billingConfig.plans) && billingConfig.plans.length > 0) {
      rawPlans = billingConfig.plans;
    } else {
      try {
        const savedBilling = localStorage.getItem('gofield_billing_config');
        if (savedBilling) {
          const parsedBilling = JSON.parse(savedBilling);
          if (parsedBilling.plans && Array.isArray(parsedBilling.plans) && parsedBilling.plans.length > 0) {
            rawPlans = parsedBilling.plans;
          }
        }
        if (rawPlans.length === 0) {
          const local = localStorage.getItem('gofield_custom_plans');
          if (local) {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) rawPlans = parsed;
          }
        }
      } catch {}
    }

    if (rawPlans.length === 0) {
      rawPlans = FALLBACK_PLANS;
    }

    // Filter STRICTLY by activeInShowcase !== false
    const filtered = rawPlans.filter((p) => p.activeInShowcase !== false);
    
    // If the admin hid everything except 1 plan, return EXACTLY that 1 plan!
    if (filtered.length > 0) {
      return filtered;
    }

    // Safety fallback: only return the primary plan if all were hidden
    return [rawPlans[0] || FALLBACK_PLANS[0]];
  }, [billingConfig?.plans]);

  // Selected plan state
  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => {
    const defaultHighlighted = availablePlans.find((p) => p.highlight) || availablePlans[0];
    return defaultHighlighted ? defaultHighlighted.id : 'pro';
  });

  // Keep selected plan valid if available plans change
  useEffect(() => {
    if (!availablePlans.some((p) => p.id === selectedPlanId)) {
      const defaultHighlighted = availablePlans.find((p) => p.highlight) || availablePlans[0];
      if (defaultHighlighted) {
        setSelectedPlanId(defaultHighlighted.id);
      }
    }
  }, [availablePlans, selectedPlanId]);

  const currentPlan = useMemo(() => {
    return availablePlans.find((p) => p.id === selectedPlanId) || availablePlans[0] || FALLBACK_PLANS[0];
  }, [availablePlans, selectedPlanId]);

  const originalPrice = currentPlan.originalPrice || (currentPlan.price * 1.5);
  const launchPrice = currentPlan.price;
  const discountBadge = currentPlan.discountBadge || 'OFERTA ESPECIAL';

  // Reset state when opened
  useEffect(() => {
    if (isUpgradeModalOpen) {
      setPaymentStep('showcase');
      setCopied(false);
      setIsGeneratingPix(false);
    }
  }, [isUpgradeModalOpen]);

  // Polling Asaas payment status when in checkout step
  useEffect(() => {
    if (paymentStep !== 'pix_checkout' || !paymentId) return;

    const interval = setInterval(async () => {
      const status = await checkAsaasPaymentStatus(paymentId, billingConfig);
      if (status === 'CONFIRMED' || status === 'RECEIVED') {
        clearInterval(interval);
        handlePaymentSuccess();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [paymentStep, paymentId, billingConfig]);

  const handlePaymentSuccess = async () => {
    if (!profile) return;
    try {
      const userRef = doc(db, 'users', profile.uid);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await updateDoc(userRef, {
        subscriptionPlan: currentPlan.id || 'pro_mensal',
        subscriptionStatus: 'active',
        subscriptionExpiresAt: expiresAt,
        subscriptionValue: launchPrice,
        paymentMethod: 'pix',
        lastPaymentDate: new Date().toISOString(),
      });
      await refreshProfile();
      setPaymentStep('success');
      notifySuccess('Assinatura Ativada!', `Seu plano "${currentPlan.name}" foi liberado com sucesso.`);
    } catch (e) {
      console.error('Error activating plan:', e);
    }
  };

  const handleStartCheckout = async (targetPlan?: PlanItemConfig) => {
    if (!profile) return;
    const planToUse = targetPlan || currentPlan;
    if (targetPlan && targetPlan.id !== selectedPlanId) {
      setSelectedPlanId(targetPlan.id);
    }
    const priceToCharge = planToUse.price;
    setIsGeneratingPix(true);

    try {
      // 1. If Asaas API Key is configured, generate dynamic PIX charge via Asaas API
      if (billingConfig?.asaasApiKey?.trim()) {
        const asaasRes = await createAsaasPixPayment(profile, priceToCharge, billingConfig);
        if (asaasRes && asaasRes.pixPayload) {
          setPaymentId(asaasRes.paymentId);
          setPixPayload(asaasRes.pixPayload);
          setPixQrCodeBase64(asaasRes.pixQrCodeBase64);
          setPaymentStep('pix_checkout');
          setIsGeneratingPix(false);
          return;
        } else {
          notifyError('Erro no Asaas', 'Não foi possível gerar a cobrança PIX no Asaas. Por favor, contate o suporte via WhatsApp.');
          setIsGeneratingPix(false);
          return;
        }
      }

      // 2. Fallback to Admin Direct PIX Key only if real
      const directPixKey = billingConfig?.pixKey?.trim() || '';
      if (directPixKey && directPixKey !== '48123456000190') {
        setPaymentId('');
        setPixPayload(directPixKey);
        setPixQrCodeBase64('');
        setPaymentStep('pix_checkout');
      } else {
        notifyWarning('Suporte Financeiro', 'Por favor, contate o suporte via WhatsApp para faturamento e ativação.');
        setIsGeneratingPix(false);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      notifyError('Erro no Checkout', 'Não foi possível iniciar o pagamento. Tente novamente.');
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    notifyInfo('Código PIX Copiado!', 'Cole no aplicativo do seu banco para concluir o pagamento.');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleManualCheck = async () => {
    setIsCheckingPayment(true);
    if (paymentId) {
      const status = await checkAsaasPaymentStatus(paymentId, billingConfig);
      if (status === 'CONFIRMED' || status === 'RECEIVED') {
        await handlePaymentSuccess();
        setIsCheckingPayment(false);
        return;
      }
    }

    // Direct confirmation fallback
    setTimeout(async () => {
      await handlePaymentSuccess();
      setIsCheckingPayment(false);
    }, 1200);
  };

  if (!isUpgradeModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header Glow */}
        <div className="absolute top-0 left-0 right-0 h-36 bg-gradient-to-b from-sky-500/20 via-amber-500/10 to-transparent pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => setIsUpgradeModalOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white bg-slate-900/80 border border-slate-800 hover:bg-slate-800 transition-all z-10 active:scale-95 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Content */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-5">

          {paymentStep === 'showcase' && (
            <>
              {/* Badge & Title */}
              <div className="text-center space-y-1.5 pt-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-sky-500/20 border border-amber-500/40 text-amber-400 text-xs font-black uppercase tracking-wider">
                  <Crown className="w-3.5 h-3.5" />
                  <span>Vitrine de Planos GoField Pro</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {isProUser ? 'Gerenciar Planos & Assinatura' : 'Desbloqueie o Poder Total do Campo'}
                </h2>
                {upgradeModalFeature ? (
                  <p className="text-xs text-sky-300 font-medium">
                    O recurso <strong className="text-white">"{upgradeModalFeature}"</strong> é exclusivo para assinantes dos planos profissionais.
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">
                    Clique no plano desejado abaixo para gerar o pagamento instantâneo via PIX.
                  </p>
                )}
              </div>

              {/* Pro / Trial Status Notice */}
              {isProUser && (
                <div className="p-3.5 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 border border-emerald-500/40 rounded-2xl text-left space-y-1 shadow-md animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-black text-emerald-300">
                      {profile?.role === 'super_admin' || profile?.email?.toLowerCase() === 'alexandre1604981@gmail.com'
                        ? 'Acesso Super Admin (Ilimitado)'
                        : profile?.subscriptionStatus === 'active'
                        ? 'Você já é um Assinante GoField Pro Ativo!'
                        : 'Você está no Período de Teste Grátis (Acesso Pro Liberado)!'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Você pode visualizar os outros planos da vitrine abaixo e contratar para renovar antecipadamente ou migrar para um plano Equipe/Corporativo.
                  </p>
                </div>
              )}

              {/* Plan Cards Grid with 1-Click Action */}
              <div className="space-y-4">
                {availablePlans.map((plan) => {
                  const origPrice = plan.originalPrice || (plan.price * 1.5);
                  const isSelected = plan.id === selectedPlanId;

                  return (
                    <div
                      key={plan.id}
                      onClick={() => handleStartCheckout(plan)}
                      className={`relative p-4 sm:p-5 rounded-3xl border-2 transition-all cursor-pointer shadow-xl ${
                        isSelected || plan.highlight
                          ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/60 border-emerald-500 ring-2 ring-emerald-500/30 hover:border-emerald-400'
                          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      } hover:scale-[1.01] active:scale-98`}
                    >
                      {plan.discountBadge && (
                        <div className="absolute -top-2.5 right-4 px-3 py-0.5 bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 text-[10px] font-black rounded-full shadow-md animate-pulse">
                          {plan.discountBadge}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base sm:text-lg font-black text-white">{plan.name}</span>
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                              {plan.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">Acesso completo e liberação imediata via PIX</p>
                        </div>

                        <div className="text-left sm:text-right">
                          {origPrice > plan.price && (
                            <span className="text-xs line-through text-slate-500 font-bold block">
                              R$ {origPrice.toFixed(2).replace('.', ',')}
                            </span>
                          )}
                          <div className="flex items-baseline sm:justify-end gap-1">
                            <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                              R$ {plan.price.toFixed(2).replace('.', ',')}
                            </span>
                            <span className="text-xs text-slate-400 font-bold">{plan.billingPeriod || '/mês'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Features */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 py-3 text-xs text-slate-200">
                        {plan.features.map((feat, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3" />
                            </div>
                            <span className="text-[11px] font-medium leading-tight">{feat}</span>
                          </div>
                        ))}
                      </div>

                      {/* 1-Click Subscribe Button inside each card */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartCheckout(plan);
                        }}
                        disabled={isGeneratingPix}
                        className="w-full mt-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-sky-500 to-emerald-500 hover:from-emerald-400 hover:to-emerald-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        {isGeneratingPix && selectedPlanId === plan.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Gerando PIX Asaas...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 fill-current text-slate-950" />
                            <span>Pagar via PIX • Liberar Acesso Imediato (R$ {plan.price.toFixed(2).replace('.', ',')})</span>
                            <ArrowRight className="w-4 h-4 ml-1" />
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Security & Warranty Note */}
              <div className="text-center pt-2 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center justify-center gap-3 text-slate-300">
                  <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Pagamento 100% Seguro</span>
                  <span>•</span>
                  <span>Liberação Automática</span>
                  <span>•</span>
                  <span>Sem Fidelidade</span>
                </div>
              </div>
            </>
          )}

          {paymentStep === 'pix_checkout' && (
            <div className="space-y-5 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto">
                <QrCode className="w-6 h-6" />
              </div>
              
              <div>
                <h3 className="text-xl font-extrabold text-white">Pagamento Instantâneo via PIX</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Plano: <strong className="text-white">{currentPlan.name}</strong> • Valor: <strong className="text-emerald-400 font-mono">R$ {launchPrice.toFixed(2).replace('.', ',')}</strong>
                </p>
              </div>

              {/* QR Code Display (Asaas Base64 or Fallback) */}
              {pixQrCodeBase64 ? (
                <div className="p-3 bg-white rounded-2xl inline-block mx-auto shadow-2xl border-4 border-emerald-500/40">
                  <img
                    src={`data:image/png;base64,${pixQrCodeBase64}`}
                    alt="QR Code Pix"
                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                  />
                </div>
              ) : (
                <div className="p-4 bg-slate-900 border border-amber-500/30 rounded-2xl space-y-2 text-left shadow-lg">
                  <p className="text-xs text-slate-400">Chave PIX Oficial ({billingConfig?.pixKeyType?.toUpperCase() || 'CNPJ'}):</p>
                  <p className="text-sm font-mono font-bold text-amber-300 break-all">{pixPayload}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Titular: {billingConfig?.beneficiaryName || 'Administração GoField Pro'}</p>
                </div>
              )}

              {/* Pix Copia e Cola */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left">
                  Código Pix Copia e Cola:
                </label>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2 text-left">
                  <input
                    type="text"
                    readOnly
                    value={pixPayload}
                    className="bg-transparent text-xs text-slate-300 font-mono flex-1 outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition-all flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Real-time Status Notice */}
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                <span>Aguardando confirmação do banco... O app liberará seu acesso na hora!</span>
              </div>

              {/* Manual Check Button */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentStep('showcase')}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition-colors"
                >
                  Voltar aos Planos
                </button>
                <button
                  type="button"
                  onClick={handleManualCheck}
                  disabled={isCheckingPayment}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all flex items-center gap-1.5 shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isCheckingPayment ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Já realizei o pagamento</span>
                </button>
              </div>
            </div>
          )}

          {paymentStep === 'success' && (
            <div className="space-y-5 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto ring-4 ring-emerald-500/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white">Parabéns! Assinatura Ativada</h3>
                <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto">
                  Você agora é assinante oficial do <strong className="text-emerald-400">{currentPlan.name}</strong>. Todos os recursos ilimitados foram desbloqueados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(false)}
                className="w-full py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm uppercase tracking-wider transition-all shadow-lg active:scale-95"
              >
                Começar a Usar Agora
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
