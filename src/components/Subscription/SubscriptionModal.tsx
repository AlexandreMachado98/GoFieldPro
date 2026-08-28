import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  ShieldCheck,
  Zap,
  ArrowRight,
  Copy,
  QrCode,
  Loader2,
  Sparkles,
  Phone,
  Gift,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  createAsaasPixPayment,
  checkAsaasPaymentStatus,
  generatePixEmvPayload,
  getPixQrCodeImageUrl,
} from '../../utils/asaasGateway';
import { getActiveShowcasePlans } from '../../services/subscriptionService';
import { PlanItemConfig, PromoCoupon } from '../../types';

export const SubscriptionModal: React.FC = () => {
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

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<PromoCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  // Dynamically get strictly active plans from Single Source of Truth
  const availablePlans = useMemo(() => {
    return getActiveShowcasePlans(billingConfig?.plans);
  }, [billingConfig?.plans]);

  // Selected plan state
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  useEffect(() => {
    if (availablePlans.length > 0) {
      if (!availablePlans.some((p) => p.id === selectedPlanId)) {
        const highlighted = availablePlans.find((p) => p.highlight) || availablePlans[0];
        setSelectedPlanId(highlighted.id);
      }
    }
  }, [availablePlans, selectedPlanId]);

  const currentPlan = useMemo(() => {
    return availablePlans.find((p) => p.id === selectedPlanId) || availablePlans[0];
  }, [availablePlans, selectedPlanId]);

  // Reset modal state on open
  useEffect(() => {
    if (isUpgradeModalOpen) {
      setPaymentStep('showcase');
      setCopied(false);
      setIsGeneratingPix(false);
      setAppliedCoupon(null);
      setCouponInput('');
      setCouponError('');
      setCouponSuccess('');
    }
  }, [isUpgradeModalOpen]);

  if (!isUpgradeModalOpen || !currentPlan) return null;

  const basePrice = currentPlan.price;
  let finalPrice = basePrice;
  if (appliedCoupon && appliedCoupon.discountPercent) {
    finalPrice = basePrice * (1 - appliedCoupon.discountPercent / 100);
  }

  // Handle Apply Coupon
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;

    setCouponLoading(true);
    setCouponError('');
    setCouponSuccess('');

    try {
      const code = couponInput.trim().toUpperCase();
      const couponsSnap = await getDocs(collection(db, 'coupons'));
      const found = couponsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as PromoCoupon))
        .find((c) => c.code.toUpperCase() === code && c.active);

      if (!found) {
        setCouponError('Cupom inválido ou expirado.');
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon(found);
        setCouponSuccess(`Cupom aplicado! ${found.discountPercent}% de desconto concedido.`);
      }
    } catch {
      setCouponError('Não foi possível validar o cupom.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleStartCheckout = async (targetPlan?: PlanItemConfig) => {
    if (!profile) return;
    const planToUse = targetPlan || currentPlan;
    if (targetPlan && targetPlan.id !== selectedPlanId) {
      setSelectedPlanId(targetPlan.id);
    }

    let priceToCharge = planToUse.price;
    if (appliedCoupon && appliedCoupon.discountPercent) {
      priceToCharge = priceToCharge * (1 - appliedCoupon.discountPercent / 100);
    }

    setIsGeneratingPix(true);

    try {
      // 1. Try Asaas Dynamic Payment if API key is active
      if (billingConfig?.asaasApiKey?.trim()) {
        const asaasRes = await createAsaasPixPayment(profile, priceToCharge, billingConfig);
        if (asaasRes && asaasRes.pixPayload) {
          setPaymentId(asaasRes.paymentId);
          setPixPayload(asaasRes.pixPayload);
          setPixQrCodeBase64(asaasRes.pixQrCodeBase64);
          setPaymentStep('pix_checkout');
          setIsGeneratingPix(false);
          return;
        }
      }

      // 2. Standard EMVCo PIX QR Code & Copia e Cola generator
      const pixKey = billingConfig?.pixKey?.trim() || 'alexandre1604981@gmail.com';
      const emvPayload = generatePixEmvPayload({
        pixKey: pixKey,
        beneficiaryName: billingConfig?.beneficiaryName || 'GoField Pro Solucoes',
        amount: priceToCharge,
        cityName: 'BRASILIA',
      });

      setPaymentId('');
      setPixPayload(emvPayload);
      setPixQrCodeBase64('');
      setPaymentStep('pix_checkout');
    } catch (err) {
      console.error('Checkout error:', err);
      const pixKey = billingConfig?.pixKey?.trim() || 'alexandre1604981@gmail.com';
      const emvPayload = generatePixEmvPayload({
        pixKey: pixKey,
        beneficiaryName: billingConfig?.beneficiaryName || 'GoField Pro Solucoes',
        amount: priceToCharge,
        cityName: 'BRASILIA',
      });
      setPaymentId('');
      setPixPayload(emvPayload);
      setPixQrCodeBase64('');
      setPaymentStep('pix_checkout');
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    notifyInfo('Código PIX Copiado!', 'Cole no app do seu banco para concluir o pagamento.');
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePaymentSuccess = async () => {
    if (!profile) return;
    try {
      const userRef = doc(db, 'users', profile.uid);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await updateDoc(userRef, {
        subscriptionPlan: currentPlan.id as any,
        subscriptionStatus: 'active',
        subscriptionExpiresAt: expiresAt,
        status: 'active',
        approvedAt: new Date().toISOString(),
      });

      await refreshProfile();
      setPaymentStep('success');
      notifySuccess('Assinatura Ativada!', `Parabéns! Seu ${currentPlan.name} está liberado com sucesso.`);
    } catch (e) {
      console.error('Error activating subscription:', e);
    }
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
    await handlePaymentSuccess();
    setIsCheckingPayment(false);
  };

  const handleOpenWhatsApp = () => {
    const rawNum = billingConfig?.whatsappSupportNumber || '5511999999999';
    const cleanNum = rawNum.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Olá, estou no GoField Pro e gostaria de confirmar meu pagamento do ${currentPlan.name} (R$ ${finalPrice.toFixed(2)}). Email: ${profile?.email}`
    );
    window.open(`https://wa.me/${cleanNum}?text=${msg}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#070A10] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <Sparkles className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Planos & Assinaturas GoField Pro</h2>
              <p className="text-[11px] text-slate-400">Acesso profissional a mapas, geoprocessamento e GPS</p>
            </div>
          </div>
          <button
            onClick={() => setIsUpgradeModalOpen(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* STEP 1: SHOWCASE */}
          {paymentStep === 'showcase' && (
            <div className="space-y-6">
              
              {upgradeModalFeature && (
                <div className="p-3.5 bg-sky-950/40 border border-sky-500/30 rounded-2xl flex items-center gap-3 text-sky-200 text-xs">
                  <Lock className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>
                    O recurso <b>"{upgradeModalFeature}"</b> é exclusivo para assinantes dos planos profissionais. Escolha seu plano abaixo para desbloquear!
                  </span>
                </div>
              )}

              {/* Dynamic Plans Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {availablePlans.map((plan) => {
                  const isSelected = plan.id === selectedPlanId;
                  const origPrice = plan.originalPrice || plan.price * 1.4;

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-b from-[#0D121D] to-[#131B2A] border-emerald-500 ring-2 ring-emerald-500/20 shadow-xl'
                          : 'bg-[#0D121D]/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {plan.discountBadge && (
                        <div className="absolute -top-3 right-3 px-2.5 py-0.5 bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-black text-[9px] uppercase tracking-wider rounded-full shadow-md">
                          {plan.discountBadge}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <h3 className="text-base font-extrabold text-white">{plan.name}</h3>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                            {plan.tag}
                          </span>
                        </div>

                        <div className="my-3">
                          {origPrice > plan.price && (
                            <span className="text-xs line-through text-slate-500 font-bold block">
                              R$ {origPrice.toFixed(2).replace('.', ',')}
                            </span>
                          )}
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                              R$ {plan.price.toFixed(2).replace('.', ',')}
                            </span>
                            <span className="text-xs text-slate-400 font-bold">{plan.billingPeriod || '/mês'}</span>
                          </div>
                        </div>

                        {/* Features List */}
                        <div className="space-y-1.5 pt-3 border-t border-slate-800/80 text-xs text-slate-300">
                          {plan.features.map((feat, idx) => (
                            <div key={idx} className="flex items-start gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span className="text-[11px] leading-snug">{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartCheckout(plan);
                        }}
                        disabled={isGeneratingPix}
                        className="w-full mt-5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        {isGeneratingPix && selectedPlanId === plan.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Gerando PIX...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            <span>Assinar • R$ {plan.price.toFixed(2).replace('.', ',')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Coupon Form */}
              <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl">
                <form onSubmit={handleApplyCoupon} className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="relative flex-1 w-full">
                    <Gift className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Possui um cupom de desconto?"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white uppercase font-mono tracking-wider focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={couponLoading || !couponInput.trim()}
                    className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {couponLoading ? 'Validando...' : 'Aplicar Cupom'}
                  </button>
                </form>
                {couponSuccess && <p className="text-[11px] text-emerald-400 font-bold mt-2">{couponSuccess}</p>}
                {couponError && <p className="text-[11px] text-rose-400 font-bold mt-2">{couponError}</p>}
              </div>
            </div>
          )}

          {/* STEP 2: PIX CHECKOUT */}
          {paymentStep === 'pix_checkout' && (
            <div className="space-y-5 text-center max-w-md mx-auto">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold animate-pulse mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Aguardando Pagamento • Liberação Imediata</span>
                </div>
                <h3 className="text-xl font-extrabold text-white">{currentPlan.name}</h3>
                <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
                  R$ {finalPrice.toFixed(2).replace('.', ',')}
                </p>
              </div>

              {/* QR Code Image */}
              <div className="p-3 bg-white rounded-2xl inline-block mx-auto shadow-2xl border-4 border-emerald-500/40">
                <img
                  src={pixQrCodeBase64 ? `data:image/png;base64,${pixQrCodeBase64}` : getPixQrCodeImageUrl(pixPayload)}
                  alt="QR Code Pix"
                  className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                />
              </div>

              {/* Copia e Cola */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold uppercase text-slate-400 block">
                  Código PIX Copia e Cola:
                </label>
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl p-1.5">
                  <input
                    type="text"
                    readOnly
                    value={pixPayload}
                    className="flex-1 bg-transparent px-2 text-xs text-slate-300 font-mono outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-lg transition-all flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleManualCheck}
                  disabled={isCheckingPayment}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isCheckingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verificando Liberação...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Já Realizei o Pagamento • Liberar Acesso</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentStep('showcase')}
                    className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    ← Voltar aos Planos
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="px-3 py-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Suporte WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {paymentStep === 'success' && (
            <div className="py-8 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-2xl animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-white">Assinatura Ativada com Sucesso!</h3>
              <p className="text-xs text-slate-300">
                Seu plano <b>{currentPlan.name}</b> foi liberado. Agora você tem acesso completo a todos os recursos profissionais!
              </p>
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(false)}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer"
              >
                Começar a Usar o GoField Pro
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
