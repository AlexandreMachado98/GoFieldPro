import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { setUserItem } from '../../utils/userStorage';
import {
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Check,
  Building2,
  User,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ApprovalCelebrationScreenProps {
  onContinue: () => void;
}

export const ApprovalCelebrationScreen: React.FC<ApprovalCelebrationScreenProps> = ({ onContinue }) => {
  const { profile } = useAuth();
  const [countdown, setCountdown] = useState<number>(6);

  useEffect(() => {
    // Big Confetti burst on load
    try {
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.6 },
      });
      const timeout = setTimeout(() => {
        confetti({
          particleCount: 50,
          spread: 120,
          origin: { y: 0.5 },
        });
      }, 400);
      return () => clearTimeout(timeout);
    } catch (e) {
      console.warn('Confetti effect', e);
    }
  }, []);

  // Automatic transition countdown
  useEffect(() => {
    if (countdown <= 0) {
      handleProceed();
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleProceed = () => {
    if (profile?.uid) {
      setUserItem(profile.uid, 'approved_acknowledged', 'true');
    }
    onContinue();
  };

  const planName =
    profile?.subscriptionPlan === 'florestal'
      ? 'Plano Florestal & Usinas (PJ)'
      : profile?.subscriptionPlan === 'equipe'
      ? 'Plano Equipe Profissional'
      : profile?.subscriptionPlan === 'pro'
      ? 'Plano Profissional Individual'
      : 'Plano Ativo (Acesso Completo)';

  return (
    <div className="h-[100dvh] w-full bg-slate-950 flex flex-col justify-center items-center p-3 sm:p-6 select-none relative overflow-y-auto overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-emerald-500/50 rounded-3xl shadow-2xl p-4.5 sm:p-7 flex flex-col items-center text-center relative z-10 animate-in zoom-in-95 duration-300 my-auto">
        {/* Animated Badge */}
        <div className="relative mb-3">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-xl shadow-emerald-900/50 animate-bounce">
            <ShieldCheck className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-950 p-1 rounded-full shadow-lg">
            <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
        </div>

        {/* Title */}
        <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 mb-1.5">
          ACESSO APROVADO & LIBERADO
        </span>

        <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
          Parabéns, seu acesso foi liberado! 🎉
        </h1>

        <p className="text-[11px] sm:text-xs text-slate-300 mt-1.5 leading-relaxed max-w-sm">
          Sua conta foi aprovada pelo administrador. Todas as ferramentas e recursos do aplicativo já estão 100% disponíveis.
        </p>

        {/* User & Plan Info Card */}
        <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-3 sm:p-3.5 mt-3.5 text-left space-y-2.5 shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="min-w-0 pr-2">
              <div className="text-[9px] text-slate-400 uppercase font-bold">Colaborador / Empresa</div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5 mt-0.5 truncate">
                <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">{profile?.name || profile?.email}</span>
              </div>
              {profile?.company && (
                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                  <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">{profile.company}</span>
                </div>
              )}
            </div>

            <div className="text-right shrink-0">
              <div className="text-[9px] text-emerald-400 uppercase font-bold">Status</div>
              <span className="text-[10px] sm:text-xs font-black text-emerald-400 bg-emerald-950/90 border border-emerald-800 px-2 py-0.5 rounded-full inline-block mt-0.5">
                ● ATIVO
              </span>
            </div>
          </div>

          <div>
            <div className="text-[9px] text-slate-400 uppercase font-bold mb-1">
              Plano Ativo & Recursos Liberados:
            </div>
            <div className="text-xs font-extrabold text-sky-400 mb-1.5 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">{planName}</span>
            </div>

            <div className="grid grid-cols-2 gap-1 text-[10px] sm:text-[11px] text-slate-300">
              <div className="flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">Mapas PDF & GPS</span>
              </div>
              <div className="flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">Cubagem (m³)</span>
              </div>
              <div className="flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">Odômetro de Frota</span>
              </div>
              <div className="flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">Laudos em PDF</span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Button with countdown */}
        <button
          onClick={handleProceed}
          className="w-full mt-4 py-3 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
        >
          <span>Entrar no GoField Pro Agora ({countdown}s)</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  );
};
