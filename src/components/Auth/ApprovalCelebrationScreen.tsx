import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Trees,
  Map,
  FileText,
  Gauge,
  Cloud,
  Check,
  Building2,
  User,
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
      localStorage.setItem(`gofield_approved_acknowledged_${profile.uid}`, 'true');
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
    <div className="min-h-[100dvh] w-full bg-slate-950 flex items-center justify-center p-3.5 sm:p-6 select-none relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/50 rounded-3xl shadow-2xl p-5 sm:p-8 flex flex-col items-center text-center relative z-10 animate-in zoom-in-95 duration-300">
        {/* Animated Badge */}
        <div className="relative mb-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-xl shadow-emerald-900/50 animate-bounce">
            <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>
          <div className="absolute -top-2 -right-2 bg-amber-400 text-slate-950 p-1.5 rounded-full shadow-lg">
            <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
        </div>

        {/* Title */}
        <span className="text-[10px] sm:text-xs uppercase font-black tracking-widest px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 mb-2">
          ACESSO APROVADO & LIBERADO
        </span>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Parabéns, seu acesso foi liberado! 🎉
        </h1>

        <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed max-w-md">
          Sua conta foi aprovada pelo administrador. Todas as ferramentas e módulos do aplicativo já estão 100% disponíveis para uso em campo.
        </p>

        {/* User & Plan Info Card */}
        <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 mt-5 text-left space-y-3 shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Colaborador / Empresa</div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
                <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">{profile?.name || profile?.email}</span>
              </div>
              {profile?.company && (
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">{profile.company}</span>
                </div>
              )}
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] text-emerald-400 uppercase font-bold">Status do Acesso</div>
              <span className="text-xs font-black text-emerald-400 bg-emerald-950/90 border border-emerald-800 px-2 py-0.5 rounded-full inline-block mt-0.5">
                ● ATIVO
              </span>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold mb-1.5">
              Plano & Recursos Desbloqueados:
            </div>
            <div className="text-xs font-extrabold text-sky-400 mb-2">{planName}</div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Mapas PDF & GPS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Cubagem Florestal (m³)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Odômetro de Frota</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Laudos Técnicos PDF</span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Button with countdown */}
        <button
          onClick={handleProceed}
          className="w-full mt-6 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
        >
          <span>Entrar no GoField Pro Agora ({countdown}s)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
