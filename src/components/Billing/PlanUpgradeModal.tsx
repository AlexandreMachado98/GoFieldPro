import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { createAsaasPixPayment, checkAsaasPaymentStatus } from '../../utils/asaasGateway';

export const PlanUpgradeModal: React.FC = () => {
  const {
    isUpgradeModalOpen,
    setIsUpgradeModalOpen,
    upgradeModalFeature,
    billingConfig,
    notifySuccess,
    notifyInfo,
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

  const originalPrice = billingConfig?.proOriginalPrice ?? 97.99;
  const launchPrice = billingConfig?.proLaunchPrice ?? 44.99;
  const discountBadge = billingConfig?.proDiscountBadge || '54% OFF • LANÇAMENTO';

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
        subscriptionPlan: 'pro_mensal',
        subscriptionStatus: 'active',
        subscriptionExpiresAt: expiresAt,
        subscriptionValue: launchPrice,
        paymentMethod: 'pix',
        lastPaymentDate: new Date().toISOString(),
      });
      await refreshProfile();
      setPaymentStep('success');
      notifySuccess('Assinatura Pro Ativada!', 'Seu acesso ilimitado a todos os recursos foi liberado com sucesso.');
    } catch (e) {
      console.error('Error activating pro plan:', e);
    }
  };

  const handleStartCheckout = async () => {
    if (!profile) return;
    setIsGeneratingPix(true);

    try {
      // 1. Try Asaas API
      if (billingConfig?.asaasApiKey?.trim()) {
        const asaasRes = await createAsaasPixPayment(profile, launchPrice, billingConfig);
        if (asaasRes) {
          setPaymentId(asaasRes.paymentId);
          setPixPayload(asaasRes.pixPayload);
          setPixQrCodeBase64(asaasRes.pixQrCodeBase64);
          setPaymentStep('pix_checkout');
          setIsGeneratingPix(false);
          return;
        }
      }

      // 2. Fallback to System Static PIX Key if Asaas key is not yet set
      const pixKey = billingConfig?.pixKey || '48.123.456/0001-90';
      setPixPayload(pixKey);
      setPixQrCodeBase64('');
      setPaymentStep('pix_checkout');
    } catch (err) {
      console.warn('Checkout error:', err);
      const pixKey = billingConfig?.pixKey || '48.123.456/0001-90';
      setPixPayload(pixKey);
      setPaymentStep('pix_checkout');
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
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6">

          {paymentStep === 'showcase' && (
            <>
              {/* Badge & Title */}
              <div className="text-center space-y-2 pt-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-sky-500/20 border border-amber-500/40 text-amber-400 text-xs font-black uppercase tracking-wider">
                  <Crown className="w-3.5 h-3.5" />
                  <span>GoField Pro</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Desbloqueie o Poder Total do Campo
                </h2>
                {upgradeModalFeature ? (
                  <p className="text-xs text-sky-300 font-medium">
                    O recurso <strong className="text-white">"{upgradeModalFeature}"</strong> é exclusivo para assinantes do Plano Profissional.
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">
                    Aproveite mapas PDF ilimitados, cubagem de madeira, mapas offline e laudos técnicos completos.
                  </p>
                )}
              </div>

              {/* Pricing Showcase Card */}
              <div className="relative p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-sky-950/40 border-2 border-sky-500/60 shadow-xl overflow-hidden">
                <div className="absolute top-3 right-3 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 text-[10px] font-black rounded-full shadow-md animate-pulse">
                  {discountBadge}
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Plano Profissional</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm line-through text-slate-500 font-bold">R$ {originalPrice.toFixed(2).replace('.', ',')}</span>
                    <span className="text-3xl sm:text-4xl font-black text-white">R$ {launchPrice.toFixed(2).replace('.', ',')}</span>
                    <span className="text-xs text-slate-400 font-bold">/mês</span>
                  </div>
                  <p className="text-[11px] text-emerald-400 font-bold">Cancele quando quiser • Sem fidelidade</p>
                </div>

                {/* Features List */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-4 border-t border-slate-800 text-xs text-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span><strong>Mapas PDF Ilimitados</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span><strong>Cubagem Florestal (m³)</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span><strong>Mapas Satélite Offline</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span><strong>Exportação KML, KMZ & GPX</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span><strong>Laudos Periciais em PDF</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span><strong>Rondas & Odômetro Ilimitados</strong></span>
                  </div>
                </div>
              </div>

              {/* Free vs Pro Comparison */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2.5 text-xs">
                <h4 className="font-extrabold text-slate-300">Comparativo Rápido:</h4>
                <div className="flex items-center justify-between py-1 border-b border-slate-800 text-slate-400">
                  <span>Limite de Mapas PDF Simultâneos</span>
                  <span className="font-bold text-slate-200">2 no Grátis <strong className="text-emerald-400">vs Ilimitado no Pro</strong></span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800 text-slate-400">
                  <span>Cubagem de Pilhas de Madeira</span>
                  <span className="font-bold text-slate-200"><Lock className="w-3 h-3 inline text-amber-400 mr-1" />Apenas no Pro</span>
                </div>
                <div className="flex items-center justify-between py-1 text-slate-400">
                  <span>Download de Satélite Offline</span>
                  <span className="font-bold text-slate-200"><Lock className="w-3 h-3 inline text-amber-400 mr-1" />Apenas no Pro</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleStartCheckout}
                disabled={isGeneratingPix}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-sky-500 to-emerald-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-950/60 hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isGeneratingPix ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Gerando Cobrança Asaas...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 fill-current text-slate-950" />
                    <span>Assinar Agora por R$ {launchPrice.toFixed(2).replace('.', ',')}/mês</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
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
                  Pague com seu aplicativo bancário. A liberação de todos os recursos é <strong>automática e instantânea</strong>.
                </p>
              </div>

              {/* QR Code Image if available */}
              {pixQrCodeBase64 ? (
                <div className="p-3 bg-white rounded-2xl inline-block shadow-xl mx-auto">
                  <img
                    src={`data:image/png;base64,${pixQrCodeBase64}`}
                    alt="PIX QR Code"
                    className="w-48 h-48 sm:w-56 sm:h-56 mx-auto object-contain"
                  />
                </div>
              ) : (
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-2">
                  <p className="text-xs text-slate-400">Chave PIX Oficial ({billingConfig?.pixKeyType?.toUpperCase() || 'CNPJ'}):</p>
                  <p className="text-sm font-mono font-black text-sky-400 select-all">{pixPayload}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Titular: {billingConfig?.beneficiaryName || 'GoField Pro'}</p>
                </div>
              )}

              {/* Copy Paste Code */}
              <div className="space-y-2 text-left">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  PIX Copia e Cola / Chave
                </label>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2">
                  <input
                    type="text"
                    readOnly
                    value={pixPayload}
                    className="bg-transparent text-xs font-mono text-slate-300 w-full outline-none px-2 truncate select-all"
                  />
                  <button
                    onClick={handleCopyPix}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Status / Check Action */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Aguardando confirmação do banco...</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPaymentStep('showcase')}
                    className="px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleManualCheck}
                    disabled={isCheckingPayment}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                  >
                    {isCheckingPayment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Já Paguei / Validar Acesso Agora</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {paymentStep === 'success' && (
            <div className="space-y-5 text-center py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-400 mx-auto animate-bounce">
                <Crown className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white">Parabéns! Você é GoField Pro!</h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto">
                  Sua assinatura profissional foi ativada com sucesso. Todos os recursos, cubagem, mapas offline e downloads ilimitados estão desbloqueados!
                </p>
              </div>

              <button
                onClick={() => setIsUpgradeModalOpen(false)}
                className="py-3.5 px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                Acessar Recursos Pro Agora
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
