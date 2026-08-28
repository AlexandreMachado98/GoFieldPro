import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  Clock,
  RefreshCw,
  LogOut,
  CheckCircle2,
  Mail,
  Sparkles,
  Send,
  Tag,
  Check,
  Percent,
  Gift,
  ArrowRight,
  AlertCircle,
  Phone,
  Building2,
  Save,
  MessageSquare,
  Zap,
  QrCode,
  Copy,
  ArrowLeft,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { doc, getDoc, updateDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SystemBillingConfig, PlanItemConfig, PromoCoupon, DEFAULT_PLANS } from '../../types';
import { ApprovalCelebrationScreen } from './ApprovalCelebrationScreen';
import { LegalPoliciesModal } from '../Legal/LegalPoliciesModal';
import {
  createAsaasPixPayment,
  checkAsaasPaymentStatus,
  generatePixEmvPayload,
  getPixQrCodeImageUrl,
} from '../../utils/asaasGateway';

export const PendingApprovalScreen: React.FC = () => {
  const { profile, logout, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [billingConfig, setBillingConfig] = useState<SystemBillingConfig | null>(() => {
    try {
      const saved = localStorage.getItem('gofield_billing_config');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [plans, setPlans] = useState<PlanItemConfig[]>(() => {
    try {
      const savedBilling = localStorage.getItem('gofield_billing_config');
      if (savedBilling) {
        const parsed = JSON.parse(savedBilling);
        if (parsed.plans && Array.isArray(parsed.plans) && parsed.plans.length > 0) {
          return parsed.plans;
        }
      }
      const saved = localStorage.getItem('gofield_custom_plans');
      return saved ? JSON.parse(saved) : DEFAULT_PLANS;
    } catch {
      return DEFAULT_PLANS;
    }
  });

  const visiblePlans = useMemo(() => {
    const active = plans.filter((p) => p.activeInShowcase !== false && (p as any).activeInShowcase !== 'false');
    return active.length > 0 ? active : [plans[0] || DEFAULT_PLANS[0]];
  }, [plans]);

  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => {
    const defaultHighlighted = visiblePlans.find((p) => p.highlight) || visiblePlans[0];
    return defaultHighlighted ? defaultHighlighted.id : 'equipe';
  });

  useEffect(() => {
    if (!visiblePlans.some((p) => p.id === selectedPlanId)) {
      const defaultPlan = visiblePlans.find((p) => p.highlight) || visiblePlans[0];
      if (defaultPlan) setSelectedPlanId(defaultPlan.id);
    }
  }, [visiblePlans, selectedPlanId]);

  const [supportPhone, setSupportPhone] = useState('5511999999999');

  const [inputPhone, setInputPhone] = useState(profile?.phone || '');
  const [inputCompany, setInputCompany] = useState(profile?.company || '');
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState('');
  const [contactSuccess, setContactSuccess] = useState(false);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<PromoCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [isPoliciesOpen, setIsPoliciesOpen] = useState(false);

  const [paymentStep, setPaymentStep] = useState<'plans' | 'pix_checkout'>('plans');
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [pixPayload, setPixPayload] = useState('');
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    refreshProfile();

    if (profile?.phone) {
      setInputPhone(profile.phone);
    }
    if (profile?.company) {
      setInputCompany(profile.company);
    }

    const billDocRef = doc(db, 'system_config', 'billing');
    const unsub = onSnapshot(
      billDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SystemBillingConfig;
          setBillingConfig(data);
          if (data.whatsappSupportNumber) {
            setSupportPhone(data.whatsappSupportNumber.replace(/\D/g, ''));
          }
          if (data.plans && Array.isArray(data.plans) && data.plans.length > 0) {
            setPlans(data.plans);
            localStorage.setItem('gofield_custom_plans', JSON.stringify(data.plans));
            localStorage.setItem('gofield_billing_config', JSON.stringify(data));
          }
        }
      },
      (e) => {
        console.warn('Real-time billing listener notice:', e.message);
      }
    );

    return () => unsub();
  }, [profile?.phone, profile?.company]);

  const handleCheckStatus = async () => {
    setChecking(true);
    await refreshProfile();
    setTimeout(() => {
      setChecking(false);
    }, 800);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setContactError('');
    setContactSuccess(false);

    const cleanDigits = inputPhone.replace(/\D/g, '');
    if (cleanDigits.length < 10 || cleanDigits.length > 11) {
      setContactError('Por favor, informe um número de WhatsApp válido com DDD (10 ou 11 dígitos).');
      return;
    }

    setSavingContact(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        phone: inputPhone.trim(),
        company: inputCompany.trim(),
        updatedAt: new Date().toISOString(),
      });
      await refreshProfile();
      setContactSuccess(true);
      setTimeout(() => setContactSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error saving user contact:', err);
      setContactError('Não foi possível salvar os dados. Tente novamente.');
    } finally {
      setSavingContact(false);
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = couponInput.trim().toUpperCase();
    if (!cleanCode) return;

    setCouponLoading(true);
    setCouponError('');
    setCouponSuccess('');

    try {
      const couponDoc = await getDoc(doc(db, 'coupons', cleanCode));
      if (couponDoc.exists()) {
        const couponData = couponDoc.data() as PromoCoupon;
        if (couponData.active) {
          setAppliedCoupon(couponData);
          setCouponSuccess(`Cupom ${couponData.code} aplicado! (${couponData.discountPercent}% OFF extra)`);
        } else {
          setCouponError('Este cupom expirou.');
        }
      } else {
        setCouponError('Cupom inválido.');
      }
    } catch (err) {
      setCouponError('Erro ao validar cupom.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponSuccess('');
    setCouponError('');
  };

  const selectedPlan = visiblePlans.find((p) => p.id === selectedPlanId) || visiblePlans[0] || DEFAULT_PLANS[0];

  const basePrice = selectedPlan.price;
  let finalPrice = basePrice;
  if (appliedCoupon && appliedCoupon.discountPercent) {
    finalPrice = basePrice * (1 - appliedCoupon.discountPercent / 100);
  }

  useEffect(() => {
    if (paymentStep !== 'pix_checkout' || !paymentId) return;

    const interval = setInterval(async () => {
      const status = await checkAsaasPaymentStatus(paymentId, billingConfig || undefined);
      if (status === 'CONFIRMED' || status === 'RECEIVED') {
        clearInterval(interval);
        handlePaymentSuccess();
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [paymentStep, paymentId, billingConfig]);

  const handlePaymentSuccess = async () => {
    if (!profile) return;
    try {
      const userRef = doc(db, 'users', profile.uid);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await updateDoc(userRef, {
        status: 'active',
        subscriptionPlan: selectedPlan.id || 'equipe',
        subscriptionStatus: 'active',
        subscriptionExpiresAt: expiresAt,
        subscriptionValue: Number(finalPrice.toFixed(2)),
        paymentMethod: 'asaas_pix',
        lastPaymentDate: new Date().toISOString(),
      });
      await refreshProfile();
    } catch (e) {
      console.error('Error activating user after payment:', e);
    }
  };

  const handleStartCheckout = async () => {
    if (!profile) return;
    setIsGeneratingPix(true);
    setCheckoutError('');

    try {
      if (billingConfig?.asaasApiKey?.trim()) {
        const asaasRes = await createAsaasPixPayment(profile, finalPrice, billingConfig);
        if (asaasRes && asaasRes.pixPayload) {
          setPaymentId(asaasRes.paymentId);
          setPixPayload(asaasRes.pixPayload);
          setPixQrCodeBase64(asaasRes.pixQrCodeBase64);
          setPaymentStep('pix_checkout');
          setIsGeneratingPix(false);
          return;
        }
      }

      // Standard EMVCo PIX QR Code & Copia e Cola generator
      const pixKey = billingConfig?.pixKey?.trim() || 'alexandre1604981@gmail.com';
      const emvPayload = generatePixEmvPayload({
        pixKey: pixKey,
        beneficiaryName: billingConfig?.beneficiaryName || 'GoField Pro Solucoes',
        amount: finalPrice,
        cityName: 'BRASILIA',
      });

      setPaymentId('');
      setPixPayload(emvPayload);
      setPixQrCodeBase64('');
      setPaymentStep('pix_checkout');
    } catch (err: any) {
      console.error('Checkout error:', err);
      const pixKey = billingConfig?.pixKey?.trim() || 'alexandre1604981@gmail.com';
      const emvPayload = generatePixEmvPayload({
        pixKey: pixKey,
        beneficiaryName: billingConfig?.beneficiaryName || 'GoField Pro Solucoes',
        amount: finalPrice,
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
    if (!pixPayload) return;
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleManualCheckPayment = async () => {
    setIsCheckingPayment(true);
    if (paymentId) {
      const status = await checkAsaasPaymentStatus(paymentId, billingConfig || undefined);
      if (status === 'CONFIRMED' || status === 'RECEIVED') {
        await handlePaymentSuccess();
        setIsCheckingPayment(false);
        return;
      }
    }
    await refreshProfile();
    setTimeout(() => {
      setIsCheckingPayment(false);
    }, 1000);
  };

  const handleOpenWhatsApp = () => {
    const currentPhone = profile?.phone || inputPhone;
    const cleanDigits = currentPhone.replace(/\D/g, '');

    if (cleanDigits.length < 10) {
      setContactError('⚠️ Preencha e salve seu WhatsApp abaixo antes de solicitar liberação.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const userName = profile?.name || 'Cliente';
    const userEmail = profile?.email || '';
    const userCompany = profile?.company || inputCompany || 'Não informada';

    let message = `Olá! Realizei meu cadastro no GoField Pro com o e-mail: ${userEmail} (Nome: ${userName}, WhatsApp: ${currentPhone}, Empresa: ${userCompany}).\n\nGostaria de liberar o meu acesso e ativar o ${selectedPlan.name} (Valor: R$ ${finalPrice.toFixed(2)}/mês).`;

    if (appliedCoupon) {
      message += `\n🏷️ Cupom de desconto aplicado: ${appliedCoupon.code} (${appliedCoupon.discountPercent}% OFF extra).`;
    }

    message += '\n\nAguardo as orientações para início imediato!';

    const cleanSupportPhone = supportPhone.startsWith('55') ? supportPhone : `55${supportPhone}`;
    const whatsappUrl = `https://wa.me/${cleanSupportPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (profile?.status === 'active') {
    return <ApprovalCelebrationScreen onContinue={refreshProfile} />;
  }

  const isBlocked = profile?.status === 'blocked';
  const hasValidPhone = Boolean(profile?.phone && profile.phone.replace(/\D/g, '').length >= 10);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-2.5 sm:p-6 relative overflow-x-hidden py-4 sm:py-8 text-slate-100 w-full">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 sm:w-[550px] h-96 sm:h-[550px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="w-full max-w-xl space-y-3 sm:space-y-4 relative z-10">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-950/50">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-black tracking-wider text-white">GoField <span className="text-emerald-400">PRO</span></span>
              <span className="text-[9px] block text-slate-400 font-mono leading-none">Adesão & Assinatura</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-full px-2.5 py-1 text-[10px] text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Liberação Automática</span>
          </div>
        </div>

        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-2xl space-y-3 sm:space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
              {paymentStep === 'pix_checkout' ? '⚡ Pagamento via PIX Instantâneo' : 'Ative sua Assinatura Profissional'}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 max-w-md mx-auto">
              {paymentStep === 'pix_checkout'
                ? 'Pague pelo seu banco e seu acesso será liberado automaticamente em segundos!'
                : 'Escolha seu plano e comece a mapear e gerar laudos de campo agora mesmo.'}
            </p>
          </div>

          {paymentStep === 'plans' && !isBlocked && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {visiblePlans.map((plan) => {
                  const isSelected = plan.id === selectedPlanId;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? plan.highlight
                            ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/60 shadow-xl'
                            : 'bg-sky-950/60 border-sky-500 ring-2 ring-sky-500/60 shadow-xl'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 opacity-85'
                      }`}
                    >
                      {plan.highlight && (
                        <div className="absolute -top-2.5 right-3 bg-emerald-500 text-slate-950 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                          Mais Escolhido
                        </div>
                      )}
                      <div>
                        <div className="flex items-center justify-between gap-1 flex-wrap mb-1">
                          <span className="text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {plan.tag}
                          </span>
                          {plan.discountBadge && (
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              {plan.discountBadge}
                            </span>
                          )}
                        </div>
                        <div className="font-extrabold text-white text-xs sm:text-sm">{plan.name}</div>
                        <div className="mt-1 bg-slate-900/80 p-1.5 sm:p-2 rounded-xl border border-slate-800">
                          {plan.originalPrice > plan.price && (
                            <div className="flex items-center gap-1 text-[9px] text-slate-400">
                              <span className="line-through font-mono font-bold text-slate-500">
                                R$ {plan.originalPrice.toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                              R$ {plan.price.toFixed(2)}
                            </span>
                            <span className="text-[9px] sm:text-[10px] text-slate-400">{plan.billingPeriod}</span>
                          </div>
                        </div>
                        <ul className="mt-1.5 space-y-0.5 sm:space-y-1 text-[9px] sm:text-[10px] text-slate-300">
                          {plan.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-1 leading-tight">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-2 pt-1.5 border-t border-slate-800/80">
                        {isSelected ? (
                          <div className="text-[9px] sm:text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Selecionado
                          </div>
                        ) : (
                          <div className="text-[9px] text-slate-500">Toque para selecionar</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Tem um Cupom de Desconto?</span>
                  </span>
                  {appliedCoupon && (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-[9px] sm:text-[10px] text-rose-400 hover:underline font-bold cursor-pointer"
                    >
                      Remover
                    </button>
                  )}
                </div>
                {appliedCoupon ? (
                  <div className="bg-emerald-950/40 border border-emerald-500/50 p-2 rounded-xl flex items-center justify-between text-xs text-emerald-300 gap-2">
                    <span className="font-bold">Cupom {appliedCoupon.code} Ativo!</span>
                    <span className="font-black text-emerald-400 font-mono text-xs sm:text-sm">R$ {finalPrice.toFixed(2)}</span>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-1.5">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Cupom"
                      className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={couponLoading || !couponInput.trim()}
                      className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow transition-all active:scale-95 shrink-0 cursor-pointer"
                    >
                      {couponLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                      <span>Aplicar</span>
                    </button>
                  </form>
                )}
                {couponError && (
                  <div className="text-[10px] text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{couponError}</span>
                  </div>
                )}
              </div>
              {checkoutError && (
                <div className="p-3 bg-rose-950/50 border border-rose-500/50 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}
              <div className="pt-1 space-y-2">
                <div className="bg-slate-950 p-2.5 sm:p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 block">Total do Plano:</span>
                    <span className="font-extrabold text-white text-xs sm:text-sm truncate">{selectedPlan.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base sm:text-2xl font-black text-emerald-400 font-mono">
                      R$ {finalPrice.toFixed(2)}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-slate-400">/mês</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStartCheckout}
                  disabled={isGeneratingPix}
                  className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black py-3 sm:py-3.5 px-4 rounded-xl sm:rounded-2xl shadow-xl shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingPix ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <Zap className="w-4 h-4 fill-slate-950" />
                  )}
                  <span>{isGeneratingPix ? 'Gerando PIX...' : 'Pagar via PIX • Liberar Acesso Imediato'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-750 text-slate-300 hover:text-white font-bold py-2.5 px-3.5 rounded-xl sm:rounded-2xl transition-all flex items-center justify-center gap-2 text-xs active:scale-98 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Dúvidas ou Faturamento PJ? Fale no WhatsApp</span>
                </button>
              </div>
            </div>
          )}

          {paymentStep === 'pix_checkout' && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Aguardando Pagamento • Liberação Automática</span>
                </div>
                <div className="py-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Valor a Pagar:</span>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                    R$ {finalPrice.toFixed(2)}
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="p-3 bg-white rounded-2xl shadow-xl">
                    <img
                      src={pixQrCodeBase64 ? `data:image/png;base64,${pixQrCodeBase64}` : getPixQrCodeImageUrl(pixPayload)}
                      alt="QR Code PIX"
                      className="w-44 h-44 sm:w-48 sm:h-48 object-contain"
                    />
                  </div>
                </div>
                {pixPayload && (
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold uppercase text-slate-400 block">Código PIX Copia e Cola:</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={pixPayload}
                        className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-[11px] text-slate-200 font-mono truncate"
                      />
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        className={`px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow active:scale-95 shrink-0 cursor-pointer ${
                          copied ? 'bg-emerald-500 text-slate-950' : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center gap-2 text-[11px] text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Assim que o pagamento for detectado, o sistema liberará seu acesso na hora.</span>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleManualCheckPayment}
                  disabled={isCheckingPayment}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isCheckingPayment ? 'animate-spin' : ''}`} />
                  <span>{isCheckingPayment ? 'Verificando...' : 'Já Realizei o Pagamento'}</span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setPaymentStep('plans')} className="py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-750 text-slate-300 font-bold text-xs rounded-xl cursor-pointer">Trocar Plano</button>
                  <button type="button" onClick={handleOpenWhatsApp} className="py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-750 text-emerald-400 font-bold text-xs rounded-xl cursor-pointer">Ajuda no WhatsApp</button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={logout}
              className="w-full py-1.5 text-xs text-slate-400 hover:text-white rounded-xl hover:bg-slate-850 transition-colors flex items-center justify-center gap-1.5 text-center cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair / Trocar de Conta</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-1 text-center text-[9px] sm:text-[10px] text-slate-500 font-medium pb-2">
          <button
            type="button"
            onClick={() => setIsPoliciesOpen(true)}
            className="text-slate-400 hover:text-emerald-400 transition-colors underline cursor-pointer text-[10px]"
          >
            Termos de Uso e Política de Privacidade (LGPD)
          </button>
          <div>GoField Pro • AM TST SAÚDE E SEGURANÇA DO TRABALHO</div>
        </div>
      </div>

      <LegalPoliciesModal isOpen={isPoliciesOpen} onClose={() => setIsPoliciesOpen(false)} />
    </div>
  );
};
