import React, { useState, useEffect } from 'react';
import { Sparkles, KeyRound, Calendar, ShieldCheck, X, ArrowRight, Clock, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSpecialAccessComputedStatus, getSpecialAccessDaysRemaining } from '../../utils/featureAccess';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface SpecialAccessModalProps {
  onOpenUpgradeModal?: () => void;
}

export const SpecialAccessModal: React.FC<SpecialAccessModalProps> = ({ onOpenUpgradeModal }) => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [modalType, setModalType] = useState<'granted' | 'expired'>('granted');
  const [savingAction, setSavingAction] = useState(false);

  useEffect(() => {
    if (!profile || !profile.specialAccess) return;

    const sa = profile.specialAccess;
    const compStatus = getSpecialAccessComputedStatus(profile);

    // 1. ACTIVE / PENDING ACCEPTANCE GREETING & INVITATION MODAL
    if (compStatus === 'active' || compStatus === 'pending_acceptance') {
      const storageKey = `sa_notified_${profile.uid}_${sa.grantedAt || sa.startsAt}`;
      const alreadyNotified = localStorage.getItem(storageKey);

      if (!alreadyNotified && !sa.acceptedAt) {
        setModalType('granted');
        setIsOpen(true);
      }
    }
    // 2. EXPIRED SPECIAL ACCESS NOTICE MODAL
    else if (compStatus === 'expired' && sa.expiresAt) {
      const storageKey = `sa_expired_notified_${profile.uid}_${sa.expiresAt}`;
      const alreadyNotified = localStorage.getItem(storageKey);

      if (!alreadyNotified) {
        setModalType('expired');
        setIsOpen(true);
      }
    }
  }, [profile]);

  // Handler: Member Accepts the Special Access
  const handleAcceptAccess = async () => {
    if (!profile || !profile.specialAccess) {
      setIsOpen(false);
      return;
    }

    setSavingAction(true);
    const sa = profile.specialAccess;
    const nowIso = new Date().toISOString();

    try {
      const storageKey = `sa_notified_${profile.uid}_${sa.grantedAt || sa.startsAt}`;
      localStorage.setItem(storageKey, 'true');

      // Atomic Update on Firestore: Transition status to 'active' and record acceptedAt
      await updateDoc(doc(db, 'users', profile.uid), {
        'specialAccess.status': 'active',
        'specialAccess.acceptedAt': nowIso,
        'specialAccess.acceptedBy': profile.email || profile.name || 'Membro',
        'specialAccess.notifiedAt': nowIso,
      });
    } catch (e) {
      console.warn('Special access acceptance update notice:', e);
    } finally {
      setSavingAction(false);
      setIsOpen(false);
    }
  };

  // Handler: Member Declines the Special Access
  const handleDeclineAccess = async () => {
    if (!profile || !profile.specialAccess) {
      setIsOpen(false);
      return;
    }

    setSavingAction(true);
    const sa = profile.specialAccess;
    const nowIso = new Date().toISOString();

    try {
      const storageKey = `sa_notified_${profile.uid}_${sa.grantedAt || sa.startsAt}`;
      localStorage.setItem(storageKey, 'true');

      await updateDoc(doc(db, 'users', profile.uid), {
        'specialAccess.status': 'declined',
        'specialAccess.declinedAt': nowIso,
        'specialAccess.declinedReason': 'Recusado pelo membro',
      });
    } catch (e) {
      console.warn('Special access decline update notice:', e);
    } finally {
      setSavingAction(false);
      setIsOpen(false);
    }
  };

  // Handler for expired modal acknowledge
  const handleAcknowledgeExpired = () => {
    if (profile?.specialAccess?.expiresAt) {
      const storageKey = `sa_expired_notified_${profile.uid}_${profile.specialAccess.expiresAt}`;
      localStorage.setItem(storageKey, 'true');
    }
    setIsOpen(false);
  };

  if (!isOpen || !profile?.specialAccess) return null;

  const sa = profile.specialAccess;
  const isLifetime = sa.accessType === 'lifetime';
  const daysRemaining = getSpecialAccessDaysRemaining(profile);

  // Format date helper DD/MM/YYYY
  const formatDateBr = (dateStr?: string | null) => {
    if (!dateStr) return 'Permanente';
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-500/50 w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 my-8 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -right-20 -top-20 w-52 h-52 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-52 h-52 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

        {modalType === 'granted' ? (
          <>
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 flex items-center justify-center mx-auto shadow-xl shadow-amber-950/60 ring-4 ring-amber-500/30">
                <Sparkles className="w-8 h-8 stroke-[2.5]" />
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                ★ Presente & Autorização VIP
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                🎉 VOCÊ RECEBEU ACESSO ESPECIAL!
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                O Super Admin liberou acesso a todos os recursos Premium para a sua conta.
              </p>
            </div>

            {/* Validity Box */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-2.5">
              <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-bold">Tipo de Concessão:</span>
                <span className="font-black text-amber-300 uppercase">
                  {isLifetime ? '👑 Vitalício (Permanente)' : sa.accessType === 'annual' ? '📅 Acesso Anual' : '⏱️ Temporário'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-bold">Válido Até:</span>
                <span className="font-black text-white">
                  {isLifetime ? 'Acesso Permanente' : formatDateBr(sa.expiresAt)}
                </span>
              </div>

              {sa.reason && (
                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                  <span className="text-slate-400 font-bold">Motivo:</span>
                  <span className="font-semibold text-slate-300 truncate max-w-[200px]">{sa.reason}</span>
                </div>
              )}

              {!isLifetime && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold">Dias Restantes:</span>
                  <span className="font-extrabold text-emerald-400">
                    {daysRemaining} dias de acesso garantido
                  </span>
                </div>
              )}
            </div>

            {/* Features list */}
            <div className="space-y-1.5 text-xs text-slate-300 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1">
                Recursos Premium Liberados:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-200">
                  <span className="text-emerald-400">✓</span> Mapas PDF Ilimitados
                </div>
                <div className="flex items-center gap-1.5 text-slate-200">
                  <span className="text-emerald-400">✓</span> Rondas & Inspeções SST
                </div>
                <div className="flex items-center gap-1.5 text-slate-200">
                  <span className="text-emerald-400">✓</span> Focos de Incêndio & Alertas
                </div>
                <div className="flex items-center gap-1.5 text-slate-200">
                  <span className="text-emerald-400">✓</span> Cubagem de Madeira (m³)
                </div>
                <div className="flex items-center gap-1.5 text-slate-200">
                  <span className="text-emerald-400">✓</span> KML / KMZ / GPX Avançado
                </div>
                <div className="flex items-center gap-1.5 text-slate-200">
                  <span className="text-emerald-400">✓</span> Satélite & Relevo Offline
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDeclineAccess}
                disabled={savingAction}
                className="w-full sm:w-1/3 py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 font-bold text-xs cursor-pointer transition-colors"
              >
                Recusar
              </button>
              <button
                type="button"
                onClick={handleAcceptAccess}
                disabled={savingAction}
                className="w-full sm:w-2/3 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer shadow-xl shadow-amber-950/60 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
              >
                <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                <span>ACEITAR ACESSO ESPECIAL</span>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Expired Modal */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-3xl bg-slate-800 text-amber-400 border border-slate-700 flex items-center justify-center mx-auto">
                <Clock className="w-8 h-8" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white">
                Seu Acesso Especial Chegou ao Fim
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                O período de concessão especial temporária encerrou em {formatDateBr(sa.expiresAt)}.
                Os recursos Premium foram pausados e sua conta retornou às permissões do seu plano original.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
              <p className="text-xs font-bold text-slate-300">Deseja continuar utilizando todos os recursos sem limites?</p>
              <p className="text-[11px] text-slate-500">Escolha um dos planos profissionais para desbloquear sua conta.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                onClick={handleAcknowledgeExpired}
                className="w-full sm:w-1/2 py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
              >
                Continuar no Gratuito
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAcknowledgeExpired();
                  if (onOpenUpgradeModal) onOpenUpgradeModal();
                }}
                className="w-full sm:w-1/2 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs cursor-pointer shadow-lg flex items-center justify-center gap-1.5 transition-all"
              >
                <span>VER PLANOS DISPONÍVEIS</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
