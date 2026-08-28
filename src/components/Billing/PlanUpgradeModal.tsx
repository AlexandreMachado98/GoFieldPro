import { getPlanEffectivePrice, formatCurrencyBRL } from '../../utils/commercialVisibility';
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
  CheckCircle,
  Tag,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  createAsaasPixPayment,
  checkAsaasPaymentStatus,
  generatePixEmvPayload,
  getPixQrCodeImageUrl,
} from '../../utils/asaasGateway';
import { PlanItemConfig, DEFAULT_PLANS, DEFAULT_FREE_PLAN, PromoCoupon, normalizePlansList } from '../../types';

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
  const [selectedPlanId, setSelectedPlanId] = useState<string>('pro');
  const [couponCodeInput, setCouponCodeInput] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<PromoCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState<boolean>(false);
  const [couponMessage, setCouponMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Available showcase plans (Dynamic from Super Admin Firestore Catalog with Plano Gratuito Guaranteed)
  const availablePlans = useMemo(() => {
    const normalized = normalizePlansList(billingConfig?.plans);
    const visible = normalized.filter((p) => p.activeInShowcase !== false && (p as any).activeInShowcase !== 'false');
    return visible.length > 0 ? visible : normalized;
  }, [billingConfig?.plans]);

  const currentPaidPlan = useMemo(() => {
    return availablePlans.find((p) => p.id === selectedPlanId && p.id !== 'free')
      || availablePlans.find((p) => p.id !== 'free')
      || DEFAULT_PLANS[1]
      || DEFAULT_PLANS[0];
  }, [availablePlans, selectedPlanId]);

  // Reset state when opened
  useEffect(() => {
    if (isUpgradeModalOpen) {
      setPaymentStep('showcase');
      setCopied(false);
      setIsGeneratingPix(false);
      setSelectedPlanId('pro');
    }
  }, [isUpgradeModalOpen]);

  const handleContinueAsFree = async () => {
    setIsUpgradeModalOpen(false);
    
    if (profile?.uid) {
      try {
        localStorage.setItem(`gofield_welcome_dismissed_${profile.uid}`, 'true');
        const userRef = doc(db, 'users', profile.uid);
        await updateDoc(userRef, {
          hasChosenPlan: true,
          subscriptionPlan: profile.subscriptionPlan || 'free',
          subscriptionStatus: profile.subscriptionStatus || 'active',
        });
        await refreshProfile();
      } catch (err) {
        console.warn('Notice saving free plan choice:', err);
      }
    }

    notifyInfo(
      'Plano Gratuito Ativo',
      'Você está utilizando o GoField Pro no Plano Gratuito (limite de até 2 mapas PDF ativos).'
    );
  };

  // Apply and validate promo coupon
  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = couponCodeInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!clean) return;

    setCouponLoading(true);
    setCouponMessage(null);

    try {
      const snap = await getDoc(doc(db, 'coupons', `coupon_${clean}`));
      if (!snap.exists()) {
        setCouponMessage({ text: `Cupom "${clean}" não encontrado.`, type: 'error' });
        setAppliedCoupon(null);
        setCouponLoading(false);
        return;
      }

      const c = snap.data() as PromoCoupon;
      if (!c.active) {
        setCouponMessage({ text: 'Este cupom está pausado ou desativado.', type: 'error' });
        setAppliedCoupon(null);
        setCouponLoading(false);
        return;
      }

      if (c.validUntil && new Date(c.validUntil) < new Date()) {
        setCouponMessage({ text: 'Este cupom já expirou.', type: 'error' });
        setAppliedCoupon(null);
        setCouponLoading(false);
        return;
      }

      if (c.maxUses && (c.usedCount || 0) >= c.maxUses) {
        setCouponMessage({ text: 'Este cupom já atingiu o limite máximo de utilizações.', type: 'error' });
        setAppliedCoupon(null);
        setCouponLoading(false);
        return;
      }

      setAppliedCoupon(c);
      const discountLabel = c.discountType === 'fixed'
        ? `R$ ${Number(c.discountFixed || 0).toFixed(2)} OFF`
        : `${c.discountPercent || 0}% OFF`;
      setCouponMessage({ text: `Cupom ${c.code} aplicado com sucesso (${discountLabel})!`, type: 'success' });
      notifySuccess('Cupom Aplicado!', `Desconto de ${discountLabel} concedido na sua assinatura.`);
    } catch (err) {
      setCouponMessage({ text: 'Erro ao validar cupom.', type: 'error' });
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const calculateFinalPrice = (basePrice: number): number => {
    if (!appliedCoupon || basePrice <= 0) return basePrice;
    if (appliedCoupon.discountType === 'fixed') {
      return Math.max(1, basePrice - (appliedCoupon.discountFixed || 0));
    }
    const percent = appliedCoupon.discountPercent || 0;
    return Math.max(1, basePrice * (1 - percent / 100));
  };

  const handleStartCheckout = async (planToBuy: PlanItemConfig) => {
    if (planToBuy.id === 'free' || planToBuy.price === 0) {
      await handleContinueAsFree();
      return;
    }

    setSelectedPlanId(planToBuy.id);
    setIsGeneratingPix(true);

    try {
      const isAsaasConfigured = Boolean(
        billingConfig?.asaasApiKey && billingConfig.asaasApiKey.trim().length > 10
      );

      if (isAsaasConfigured && profile) {
        const effectivePrice = getPlanEffectivePrice(planToBuy).price;
        const finalPrice = calculateFinalPrice(effectivePrice);
        const asaasResult = await createAsaasPixPayment(profile, finalPrice, billingConfig);

        if (asaasResult && asaasResult.pixPayload) {
          setPixPayload(asaasResult.pixPayload);
          setPixQrCodeBase64(asaasResult.pixQrCodeBase64 || '');
          setPaymentId(asaasResult.paymentId || '');
          setPaymentStep('pix_checkout');
          setIsGeneratingPix(false);
          return;
        }
      }

      // Fallback EMVCo Instant Pix Code
      const pixKey = billingConfig?.pixKey?.trim() || 'alexandre1604981@gmail.com';
      const beneficiary = billingConfig?.beneficiaryName?.trim() || 'AM TST SAUDE';
      const fallbackPayload = generatePixEmvPayload({
        pixKey,
        beneficiaryName: beneficiary,
        amount: calculateFinalPrice(getPlanEffectivePrice(planToBuy).price),
        cityName: 'BRASILIA',
              });

      setPixPayload(fallbackPayload);
      setPixQrCodeBase64('');
      setPaymentId('');
      setPaymentStep('pix_checkout');
    } catch (err: any) {
      console.error('Error starting checkout:', err);
      const pixKey = billingConfig?.pixKey?.trim() || 'alexandre1604981@gmail.com';
      const fallbackPayload = generatePixEmvPayload({
        pixKey,
        beneficiaryName: 'AM TST SAUDE',
        amount: planToBuy.price,
        cityName: 'BRASILIA',
      });
      setPixPayload(fallbackPayload);
      setPaymentStep('pix_checkout');
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleCopyPix = () => {
    if (!pixPayload) return;
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleManualCheck = async () => {
    setIsCheckingPayment(true);
    setTimeout(async () => {
      if (!profile) {
        setIsCheckingPayment(false);
        return;
      }
      try {
        const userRef = doc(db, 'users', profile.uid);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await updateDoc(userRef, {
          status: 'active',
          subscriptionPlan: currentPaidPlan.id || 'pro_mensal',
          subscriptionStatus: 'active',
          subscriptionExpiresAt: expiresAt,
          subscriptionValue: Number(currentPaidPlan.price.toFixed(2)),
          paymentMethod: 'pix',
          lastPaymentDate: new Date().toISOString(),
          hasChosenPlan: true,
        });
        await refreshProfile();
        if (appliedCoupon) {
          try {
            const coupRef = doc(db, 'coupons', appliedCoupon.id);
            const coupSnap = await getDoc(coupRef);
            if (coupSnap.exists()) {
              const currentCount = coupSnap.data().usedCount || 0;
              await updateDoc(coupRef, { usedCount: currentCount + 1 });
            }
          } catch (e) {
            console.warn('Notice updating coupon usedCount:', e);
          }
        }
        setPaymentStep('success');
      } catch (err) {
        console.error('Error manually activating subscription:', err);
      }
      setIsCheckingPayment(false);
    }, 1200);
  };

  if (!isUpgradeModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#0F172A] to-[#090D16] border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden my-auto">
        
        {/* Glow Header Accent */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-sky-500 via-emerald-500 to-teal-400" />
        
        {/* Close Button */}
        <button
          onClick={handleContinueAsFree}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-700/80 transition-all active:scale-95 z-20 cursor-pointer"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-4 sm:p-7 space-y-5">
          {paymentStep === 'showcase' && (
            <>
              {/* Header Title */}
              <div className="text-center space-y-1.5 pt-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-black uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Escolha Seu Plano</span>
                </div>
                
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {upgradeModalFeature
                    ? `Desbloqueie "${upgradeModalFeature}"`
                    : 'Aproveite todos os recursos do GoField Pro'}
                </h2>
                
                <p className="text-xs text-slate-400 max-w-lg mx-auto">
                  Você pode usar o aplicativo no <strong>Plano Gratuito</strong> ou assinar um dos nossos planos para recursos e mapas ilimitados.
                </p>
              </div>

                            {/* Promo Coupon Input Box */}
              <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                    <Tag className="w-3.5 h-3.5 text-pink-400" />
                    Possui um cupom de desconto?
                  </span>
                  {appliedCoupon && (
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCoupon(null);
                        setCouponMessage(null);
                        setCouponCodeInput('');
                      }}
                      className="text-[10px] text-slate-400 hover:text-rose-400 font-bold underline cursor-pointer"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                    placeholder="DIGITE SEU CUPOM (EX: PROMO20)"
                    disabled={couponLoading || !!appliedCoupon}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-pink-500 uppercase disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon()}
                    disabled={couponLoading || !couponCodeInput.trim() || !!appliedCoupon}
                    className="px-4 py-2 bg-pink-600 hover:bg-pink-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    {couponLoading ? 'Validando...' : appliedCoupon ? 'Aplicado ✓' : 'Aplicar'}
                  </button>
                </div>

                {couponMessage && (
                  <p className={`text-[11px] font-bold ${couponMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {couponMessage.text}
                  </p>
                )}
              </div>

              {/* Plans Comparison Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {availablePlans.map((plan) => {
                  const isFree = plan.id === 'free' || plan.price === 0;
                  const isHighlighted = plan.highlight || !isFree;

                  return (
                    <div
                      key={plan.id}
                      className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all relative border ${
                        isHighlighted
                          ? 'bg-gradient-to-b from-emerald-950/40 via-slate-900/90 to-slate-950 border-emerald-500/60 ring-2 ring-emerald-500/40 shadow-xl'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {isHighlighted && (
                        <div className="absolute -top-3 right-4 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">
                          {plan.discountBadge || 'Recomendado'}
                        </div>
                      )}

                      <div>
                        {/* Tag & Plan Name */}
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                            {plan.tag || (isFree ? 'Gratuito' : 'Profissional')}
                          </span>
                          {isFree && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30">
                              Sem Custos
                            </span>
                          )}
                        </div>

                        <h3 className="font-extrabold text-white text-base sm:text-lg">{plan.name}</h3>

                        {/* Pricing Box */}
                        {(() => {
                          const eff = getPlanEffectivePrice(plan);
                          const finalVal = calculateFinalPrice(eff.price);
                          return (
                            <div className="my-2.5 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                              {appliedCoupon && !isFree ? (
                                <div>
                                  <div className="text-[10px] text-slate-400 line-through font-mono">
                                    {formatCurrencyBRL(eff.price)}
                                  </div>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                                      {formatCurrencyBRL(finalVal)}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      {plan.billingPeriod || '/mês'}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  {eff.originalPrice > eff.price && (
                                    <div className="text-[10px] text-slate-400 line-through font-mono">
                                      {formatCurrencyBRL(eff.originalPrice)}
                                    </div>
                                  )}
                                  <div className="flex items-baseline gap-1">
                                    <span className={`text-xl sm:text-2xl font-black font-mono ${isFree ? 'text-sky-400' : 'text-emerald-400'}`}>
                                      {formatCurrencyBRL(eff.price)}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      {plan.billingPeriod || (isFree ? '/sempre' : '/mês')}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Features List */}
                        <ul className="space-y-1.5 text-xs text-slate-300 mb-4">
                          {plan.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2 leading-tight">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                isFree ? 'bg-sky-500/20 text-sky-400' : 'bg-emerald-500/20 text-emerald-400'
                              }`}>
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                              <span className="text-[11px]">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Action Button */}
                      <div>
                        {isFree ? (
                          <button
                            type="button"
                            onClick={handleContinueAsFree}
                            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-sky-300 hover:text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow"
                          >
                            <span>Continuar Gratuitamente</span>
                            <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartCheckout(plan)}
                            disabled={isGeneratingPix}
                            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-lg shadow-emerald-950/60 disabled:opacity-50"
                          >
                            {isGeneratingPix && selectedPlanId === plan.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Gerando PIX...</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-4 h-4 fill-current text-slate-950" />
                                <span>Assinar Plano Pro</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Prominent Free Tier Option */}
              <div className="pt-2 text-center space-y-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={handleContinueAsFree}
                  className="text-xs sm:text-sm font-black text-slate-300 hover:text-sky-300 transition-colors inline-flex items-center gap-1.5 underline cursor-pointer py-1"
                >
                  <span>Continuar usando gratuitamente</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-400" /> Pagamento 100% Seguro</span>
                  <span>•</span>
                  <span>Liberação Automática</span>
                  <span>•</span>
                  <span>Cancele Quando Quiser</span>
                </div>
              </div>
            </>
          )}

          {paymentStep === 'pix_checkout' && (
            <div className="space-y-4 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto">
                <QrCode className="w-6 h-6" />
              </div>
              
              <div>
                <h3 className="text-xl font-extrabold text-white">Pagamento Instantâneo via PIX</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Plano: <strong className="text-white">{currentPaidPlan.name}</strong> • Valor: <strong className="text-emerald-400 font-mono">{formatCurrencyBRL(calculateFinalPrice(getPlanEffectivePrice(currentPaidPlan).price))}</strong>
                </p>
              </div>

              {/* QR Code Display */}
              <div className="p-3 bg-white rounded-2xl inline-block mx-auto shadow-2xl border-4 border-emerald-500/40">
                <img
                  src={pixQrCodeBase64 ? `data:image/png;base64,${pixQrCodeBase64}` : getPixQrCodeImageUrl(pixPayload)}
                  alt="QR Code Pix"
                  className="w-44 h-44 sm:w-52 sm:h-52 object-contain"
                />
              </div>

              {/* Pix Copia e Cola */}
              <div className="space-y-1.5 text-left">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Código Pix Copia e Cola:
                </label>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2">
                  <input
                    type="text"
                    readOnly
                    value={pixPayload}
                    className="bg-transparent text-xs text-slate-300 font-mono flex-1 outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className={`px-3 py-1.5 font-bold text-xs rounded-lg transition-all flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer ${
                      copied ? 'bg-emerald-500 text-slate-950' : 'bg-sky-500 text-slate-950'
                    }`}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Status Notice */}
              <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                <span>Aguardando confirmação do banco... O app liberará seu acesso na hora!</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentStep('showcase')}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
                >
                  Voltar aos Planos
                </button>
                <button
                  type="button"
                  onClick={handleManualCheck}
                  disabled={isCheckingPayment}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all flex items-center gap-1.5 shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isCheckingPayment ? 'animate-spin' : ''}`} />
                  <span>{isCheckingPayment ? 'Verificando...' : 'Já realizei o pagamento'}</span>
                </button>
              </div>

              {/* Skip and Use Free fallback option */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleContinueAsFree}
                  className="text-[11px] text-slate-400 hover:text-sky-300 underline cursor-pointer"
                >
                  Pagar depois e continuar usando no Plano Gratuito
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
                  Você agora é assinante oficial do <strong className="text-emerald-400">{currentPaidPlan.name}</strong>. Todos os recursos e mapas ilimitados foram desbloqueados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(false)}
                className="w-full py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer"
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
