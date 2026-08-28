import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  LogOut,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  Building2,
  Lock,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SystemBillingConfig } from '../../types';
import { LegalPoliciesModal } from '../Legal/LegalPoliciesModal';

export const PendingApprovalScreen: React.FC = () => {
  const { profile, logout, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [supportPhone, setSupportPhone] = useState('5511999999999');
  const [isPoliciesOpen, setIsPoliciesOpen] = useState(false);

  useEffect(() => {
    refreshProfile();
    const billDocRef = doc(db, 'system_config', 'billing');
    const unsub = onSnapshot(billDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as SystemBillingConfig;
        if (data.whatsappSupportNumber) {
          setSupportPhone(data.whatsappSupportNumber.replace(/\D/g, ''));
        }
      }
    });
    return () => unsub();
  }, []);

  const handleOpenWhatsApp = () => {
    const userName = profile?.name || 'Cliente';
    const userEmail = profile?.email || '';
    const message = `Olá! Sou o usuário ${userName} (${userEmail}) do GoField Pro e gostaria de regularizar meu acesso ao sistema.`;
    const cleanSupportPhone = supportPhone.startsWith('55') ? supportPhone : `55${supportPhone}`;
    window.open(`https://wa.me/${cleanSupportPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    await refreshProfile();
    setTimeout(() => setChecking(false), 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative text-slate-100 w-full">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative z-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto ring-4 ring-rose-500/10">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Acesso Temporariamente Suspenso
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Sua conta (<strong className="text-slate-300">{profile?.email}</strong>) está com o acesso suspenso pela administração do sistema.
          </p>
        </div>

        {profile?.blockReason && (
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-left text-xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Motivo informado:</span>
            <p className="text-slate-200">{profile.blockReason}</p>
          </div>
        )}

        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 active:scale-95 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Falar com o Suporte / Administração</span>
          </button>

          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={checking}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Verificando...' : 'Verificar se já fui liberado'}</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full py-2 text-xs text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair / Trocar de Conta</span>
          </button>
        </div>

        <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500">
          <button
            type="button"
            onClick={() => setIsPoliciesOpen(true)}
            className="hover:text-emerald-400 underline transition-colors cursor-pointer"
          >
            Termos de Uso e Privacidade
          </button>
        </div>
      </div>

      <LegalPoliciesModal isOpen={isPoliciesOpen} onClose={() => setIsPoliciesOpen(false)} />
    </div>
  );
};
