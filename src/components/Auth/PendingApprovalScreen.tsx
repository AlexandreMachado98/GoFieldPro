import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SystemBillingConfig, PlanItemConfig, PromoCoupon } from '../../types';
import { ApprovalCelebrationScreen } from './ApprovalCelebrationScreen';
import { LegalPoliciesModal } from '../Legal/LegalPoliciesModal';

const FALLBACK_PLANS: PlanItemConfig[] = [
  {
    id: 'pro',
    name: 'Plano Profissional',
    tag: 'Individual',
    originalPrice: 149,
    price: 97,
    discountBadge: '35% OFF',
    billingPeriod: '/mês',
    features: [
      '1 Operador de Campo',
      'Mapas PDF e GPS Ilimitados',
      'Medição de Pilha de Madeira (m³)',
      'Relatórios Técnicos em PDF',
    ],
    highlight: false,
  },
  {
    id: 'equipe',
    name: 'Plano Equipe',
    tag: 'Mais Popular',
    originalPrice: 390,
    price: 289,
    discountBadge: 'Economize R$ 101/mês',
    billingPeriod: '/mês',
    features: [
      'Até 5 Técnicos de Campo',
      'Painel de Gestão da Frota & Odômetro',
      'Cubagem Florestal e Laudos em Lote',
      'Backup e Sincronização em Nuvem',
    ],
    highlight: true,
  },
  {
    id: 'florestal',
    name: 'Florestal & Usinas',
    tag: 'Corporativo',
    originalPrice: 950,
    price: 690,
    discountBadge: '27% OFF',
    billingPeriod: '/mês',
    features: [
      '15 a 30 Operadores simultâneos',
      'Logotipo da Empresa nos Laudos PDF',
      'Contratos e Faturamento PJ',
      'Treinamento e Suporte VIP Prioritário',
    ],
    highlight: false,
  },
];

export const PendingApprovalScreen: React.FC = () => {
  const { profile, logout, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [plans, setPlans] = useState<PlanItemConfig[]>(() => {
    try {
      const saved = localStorage.getItem('gofield_custom_plans');
      return saved ? JSON.parse(saved) : FALLBACK_PLANS;
    } catch {
      return FALLBACK_PLANS;
    }
  });
  const [selectedPlanId, setSelectedPlanId] = useState<string>('equipe');
  const [supportPhone, setSupportPhone] = useState('5511999999999');

  // WhatsApp & Company Missing Capture State (for Google Login / Incomplete profiles)
  const [inputPhone, setInputPhone] = useState(profile?.phone || '');
  const [inputCompany, setInputCompany] = useState(profile?.company || '');
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState('');
  const [contactSuccess, setContactSuccess] = useState(false);

  // Coupon State
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<PromoCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [isPoliciesOpen, setIsPoliciesOpen] = useState(false);

  useEffect(() => {
    refreshProfile();

    if (profile?.phone) {
      setInputPhone(profile.phone);
    }
    if (profile?.company) {
      setInputCompany(profile.company);
    }

    const loadBillingAndPlans = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'system_config', 'billing'));
        if (configDoc.exists()) {
          const data = configDoc.data() as SystemBillingConfig;
          if (data.whatsappSupportNumber) {
            setSupportPhone(data.whatsappSupportNumber.replace(/\D/g, ''));
          }
          if (data.plans && Array.isArray(data.plans) && data.plans.length > 0) {
            setPlans(data.plans);
            localStorage.setItem('gofield_custom_plans', JSON.stringify(data.plans));
          }
        }
      } catch (e) {
        console.warn('Could not fetch billing config, using fallback plans', e);
      }
    };

    loadBillingAndPlans();
  }, [profile?.phone, profile?.company]);

  const handleCheckStatus = async () => {
    setChecking(true);
    await refreshProfile();
    setTimeout(() => {
      setChecking(false);
    }, 800);
  };

  // Format phone automatically: (XX) XXXXX-XXXX
  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    if (digits.length > 7) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    setInputPhone(formatted);
  };

  // Save mandatory WhatsApp to Firestore profile
  const handleSaveContactInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError('');

    const cleanPhone = inputPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setContactError('Informe seu WhatsApp com DDD (ex: 11 99999-9999).');
      return;
    }

    if (!profile?.uid) return;

    setSavingContact(true);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        phone: inputPhone.trim(),
        company: inputCompany.trim() || 'Não informada',
      });

      await refreshProfile();
      setContactSuccess(true);
      setTimeout(() => setContactSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving contact phone:', err);
      setContactError('Não foi possível salvar os dados. Tente novamente.');
    } finally {
      setSavingContact(false);
    }
  };

  // Validate and Apply Promo Coupon
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    setCouponSuccess('');

    const cleanCode = couponInput.trim().toUpperCase();
    if (!cleanCode) return;

    setCouponLoading(true);
    try {
      const couponDoc = await getDoc(doc(db, 'coupons', `coupon_${cleanCode}`));
      if (couponDoc.exists()) {
        const couponData = couponDoc.data() as PromoCoupon;
        if (couponData.active) {
          setAppliedCoupon(couponData);
          setCouponSuccess(`Cupom ${couponData.code} aplicado! (${couponData.discountPercent}% OFF extra)`);
        } else {
          setCouponError('Este cupom expirou ou não está ativo.');
        }
      } else {
        const allCouponsSnap = await getDocs(collection(db, 'coupons'));
        const matched = allCouponsSnap.docs
          .map((d) => d.data() as PromoCoupon)
          .find((c) => c.code.toUpperCase() === cleanCode && c.active);

        if (matched) {
          setAppliedCoupon(matched);
          setCouponSuccess(`Cupom ${matched.code} aplicado! (${matched.discountPercent}% OFF extra)`);
        } else {
          setCouponError('Cupom inválido ou não encontrado.');
        }
      }
    } catch (err) {
      console.error('Error applying coupon:', err);
      setCouponError('Não foi possível validar o cupom.');
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

  if (profile?.status === 'active') {
    return <ApprovalCelebrationScreen onContinue={refreshProfile} />;
  }

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0] || FALLBACK_PLANS[0];

  const basePrice = selectedPlan.price;
  let finalPrice = basePrice;
  if (appliedCoupon && appliedCoupon.discountPercent) {
    finalPrice = basePrice * (1 - appliedCoupon.discountPercent / 100);
  }

  const handleOpenWhatsApp = () => {
    const currentPhone = profile?.phone || inputPhone;
    const cleanDigits = currentPhone.replace(/\D/g, '');

    // If phone is still missing, prompt user
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

  const isBlocked = profile?.status === 'blocked';
  const hasValidPhone = Boolean(profile?.phone && profile.phone.replace(/\D/g, '').length >= 10);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-2.5 sm:p-6 relative overflow-x-hidden py-4 sm:py-8 text-slate-100 w-full">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[15%] left-[10%] w-[45%] h-[45%] rounded-full bg-amber-500/10 blur-[130px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[130px]" />
      </div>

      <div className="w-full max-w-xl sm:max-w-2xl z-10 space-y-3 sm:space-y-4">
        {/* Main Card */}
        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-2xl space-y-3 sm:space-y-4">
          {/* Header */}
          <div className="text-center space-y-1">
            <div
              className={`w-11 h-11 sm:w-14 sm:h-14 rounded-2xl mx-auto flex items-center justify-center shadow-xl ${
                isBlocked
                  ? 'bg-rose-950 border border-rose-800 text-rose-400'
                  : 'bg-amber-950/80 border border-amber-500/40 text-amber-400'
              }`}
            >
              {isBlocked ? <ShieldAlert className="w-5 h-5 sm:w-7 sm:h-7" /> : <Clock className="w-5 h-5 sm:w-7 sm:h-7 animate-pulse" />}
            </div>

            <h1 className="text-base sm:text-2xl font-extrabold text-white tracking-tight">
              {isBlocked ? 'Acesso Suspenso' : 'Solicitação em Análise'}
            </h1>

            <p className="text-[11px] sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              {isBlocked
                ? 'Seu acesso ao sistema está suspenso. Fale com nossa equipe comercial para reativar seu plano.'
                : 'Seu cadastro foi registrado com sucesso! Escolha o seu plano abaixo com valores promocionais e solicite a liberação imediata via WhatsApp.'}
            </p>
          </div>

          {/* User Identification Chip */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={
                  profile?.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'U')}&background=0284c7&color=fff`
                }
                alt={profile?.name}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-slate-700 object-cover shrink-0"
              />
              <div className="min-w-0">
                <div className="font-bold text-xs sm:text-sm text-white truncate">{profile?.name}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1 truncate">
                  <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">{profile?.email}</span>
                </div>
              </div>
            </div>

            <span
              className={`text-[8px] sm:text-[9px] font-black px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border uppercase tracking-wider shrink-0 ${
                isBlocked
                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
              }`}
            >
              {isBlocked ? 'Suspenso' : 'Pendente'}
            </span>
          </div>

          {/* ========================================================================= */}
          {/* OBRIGATORIEDADE DE WHATSAPP (SE CADASTRO GOOGLE SEM TELEFONE)              */}
          {/* ========================================================================= */}
          {!isBlocked && !hasValidPhone && (
            <div className="bg-amber-950/40 border border-amber-500/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-2 animate-in fade-in duration-300 ring-1 ring-amber-500/40">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-extrabold text-amber-300 leading-tight">
                    WhatsApp Obrigatório para Liberação
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                    Informe seu WhatsApp com DDD para que o Administrador possa registrar sua conta e liberar seu acesso.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveContactInfo} className="space-y-2 pt-0.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                  <div>
                    <label className="block text-[9px] sm:text-[10px] uppercase font-bold text-slate-300 mb-0.5">
                      WhatsApp com DDD *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <MessageSquare className="w-3 h-3 text-slate-500" />
                      </div>
                      <input
                        type="tel"
                        required
                        value={inputPhone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] sm:text-[10px] uppercase font-bold text-slate-300 mb-0.5">
                      Empresa / Atividade
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <Building2 className="w-3 h-3 text-slate-500" />
                      </div>
                      <input
                        type="text"
                        value={inputCompany}
                        onChange={(e) => setInputCompany(e.target.value)}
                        placeholder="Ex: Madeireira / Autônomo"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {contactError && (
                  <div className="text-[10px] sm:text-[11px] text-red-400 flex items-center gap-1 font-semibold">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{contactError}</span>
                  </div>
                )}

                {contactSuccess && (
                  <div className="text-[10px] sm:text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>WhatsApp salvo! Você já pode escolher seu plano abaixo.</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingContact}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 font-black py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-98"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingContact ? 'Salvando...' : 'Salvar WhatsApp e Prosseguir'}</span>
                </button>
              </form>
            </div>
          )}

          {/* User WhatsApp verified badge */}
          {!isBlocked && hasValidPhone && (
            <div className="bg-slate-950 p-2 sm:p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs gap-2 min-w-0">
              <div className="flex items-center gap-1.5 text-slate-300 min-w-0 truncate">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate text-[11px] sm:text-xs">
                  WhatsApp: <b className="text-white font-mono">{profile?.phone}</b>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInputPhone(profile?.phone || '');
                  setInputCompany(profile?.company || '');
                  updateDoc(doc(db, 'users', profile!.uid), { phone: '' }).then(() => refreshProfile());
                }}
                className="text-[10px] text-sky-400 hover:underline font-bold shrink-0"
              >
                Alterar
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VITRINE DE PLANOS COM PREÇO CHEIO, DESCONTO & SERVIÇOS                    */}
          {/* ========================================================================= */}
          {!isBlocked && (
            <div className="space-y-2.5 pt-0.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-sky-400" />
                  <span>Escolha seu Plano:</span>
                </h3>
                <span className="text-[9px] sm:text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Valores Promocionais
                </span>
              </div>

              {/* Plans Grid (1 Col on mobile, 3 Cols on sm+) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {plans.map((plan) => {
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
                        {/* Tag & Discount Badge */}
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

                        {/* Pricing with Original Crossed-Out Price and Discounted Price */}
                        <div className="mt-1 bg-slate-900/80 p-1.5 sm:p-2 rounded-xl border border-slate-800">
                          {plan.originalPrice > plan.price && (
                            <div className="flex items-center gap-1 text-[9px] text-slate-400">
                              <span className="text-slate-500">De:</span>
                              <span className="line-through font-mono font-bold text-slate-500">
                                R$ {plan.originalPrice.toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="flex items-baseline gap-1">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-300">Por:</span>
                            <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                              R$ {plan.price.toFixed(2)}
                            </span>
                            <span className="text-[9px] sm:text-[10px] text-slate-400">{plan.billingPeriod}</span>
                          </div>
                        </div>

                        {/* Features List */}
                        <ul className="mt-1.5 space-y-0.5 sm:space-y-1 text-[9px] sm:text-[10px] text-slate-300">
                          {plan.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-1 leading-tight">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Selection Indicator */}
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

              {/* Cupom de Desconto */}
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
                      className="text-[9px] sm:text-[10px] text-rose-400 hover:underline font-bold"
                    >
                      Remover
                    </button>
                  )}
                </div>

                {appliedCoupon ? (
                  <div className="bg-emerald-950/40 border border-emerald-500/50 p-2 rounded-xl flex items-center justify-between text-xs text-emerald-300 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-bold block truncate text-[11px] sm:text-xs">Cupom {appliedCoupon.code} Ativo!</span>
                        <span className="text-[9px] sm:text-[10px] text-slate-300 block truncate">
                          {appliedCoupon.discountPercent}% de desconto extra aplicado.
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[8px] sm:text-[9px] text-slate-400 block line-through">
                        R$ {basePrice.toFixed(2)}
                      </span>
                      <span className="font-black text-emerald-400 font-mono text-xs sm:text-sm">
                        R$ {finalPrice.toFixed(2)}/mês
                      </span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-1.5">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Cupom (Ex: REGIAO20)"
                      className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={couponLoading || !couponInput.trim()}
                      className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow transition-all active:scale-95 shrink-0"
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

              {/* Final Summary & WhatsApp Activation Button */}
              <div className="pt-1 space-y-1.5">
                <div className="bg-slate-950 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 block">Total do Plano:</span>
                    <span className="font-extrabold text-white text-xs sm:text-sm truncate">{selectedPlan.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base sm:text-xl font-black text-emerald-400 font-mono">
                      R$ {finalPrice.toFixed(2)}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-slate-400">/mês</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-2.5 sm:py-3 px-3.5 rounded-xl sm:rounded-2xl shadow-xl shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-98"
                >
                  <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>Liberar no WhatsApp com Desconto</span>
                </button>
                <p className="text-[9px] sm:text-[10px] text-center text-slate-400">
                  Fale com a nossa equipe para liberação imediata e orientações de uso.
                </p>
              </div>
            </div>
          )}

          {/* Secondary Actions */}
          <div className="space-y-1.5 pt-1.5 border-t border-slate-800">
            {!isBlocked && (
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={checking}
                className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-750 text-sky-400 font-bold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                <span className="truncate">{checking ? 'Verificando...' : 'Verificar se meu Acesso foi Liberado'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={logout}
              className="w-full py-1.5 text-xs text-slate-400 hover:text-white rounded-xl hover:bg-slate-850 transition-colors flex items-center justify-center gap-1.5 text-center"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair / Trocar de Conta</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center justify-center gap-1.5 text-center text-[9px] sm:text-[10px] text-slate-500 font-medium pb-4">
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
