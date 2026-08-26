import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  Clock,
  RefreshCw,
  LogOut,
  CheckCircle2,
  PhoneCall,
  Mail,
  Building2,
  Sparkles,
  Send,
  Tag,
  Check,
  Zap,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SystemBillingConfig } from '../../types';

export const PendingApprovalScreen: React.FC = () => {
  const { profile, logout, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'equipe' | 'florestal'>('equipe');
  const [supportPhone, setSupportPhone] = useState('5511999999999');

  useEffect(() => {
    refreshProfile();

    // Fetch support phone number from Firestore if configured
    const loadBillingConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'system_config', 'billing'));
        if (configDoc.exists()) {
          const data = configDoc.data() as SystemBillingConfig;
          if (data.whatsappSupportNumber) {
            setSupportPhone(data.whatsappSupportNumber.replace(/\D/g, ''));
          }
        }
      } catch (e) {
        console.warn('Could not fetch billing config', e);
      }
    };

    loadBillingConfig();
  }, []);

  const handleCheckStatus = async () => {
    setChecking(true);
    await refreshProfile();
    setTimeout(() => {
      setChecking(false);
    }, 800);
  };

  const handleOpenWhatsApp = () => {
    const planName =
      selectedPlan === 'pro'
        ? 'Plano Profissional (R$ 97/mês)'
        : selectedPlan === 'florestal'
        ? 'Plano Florestal & Usinas (R$ 690/mês)'
        : 'Plano Equipe (R$ 289/mês)';

    const userName = profile?.name || 'Cliente';
    const userEmail = profile?.email || '';
    const userCompany = profile?.company || 'Não informada';

    const message = `Olá! Realizei meu cadastro no GoField Pro com o e-mail: ${userEmail} (Nome: ${userName}, Empresa: ${userCompany}). Gostaria de liberar o meu acesso e ativar o ${planName} / iniciar meu teste grátis.`;

    const cleanPhone = supportPhone.startsWith('55') ? supportPhone : `55${supportPhone}`;
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const isBlocked = profile?.status === 'blocked';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-3 sm:p-6 relative overflow-x-hidden py-8 sm:py-12 text-slate-100">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[15%] left-[10%] w-[45%] h-[45%] rounded-full bg-amber-500/10 blur-[130px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[130px]" />
      </div>

      <div className="w-full max-w-xl z-10 space-y-4">
        {/* Main Card */}
        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl p-4 sm:p-7 shadow-2xl space-y-4 sm:space-y-5">
          {/* Header */}
          <div className="text-center space-y-2">
            <div
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-xl ${
                isBlocked
                  ? 'bg-rose-950 border border-rose-800 text-rose-400'
                  : 'bg-amber-950/80 border border-amber-500/40 text-amber-400'
              }`}
            >
              {isBlocked ? <ShieldAlert className="w-7 h-7" /> : <Clock className="w-7 h-7 animate-pulse" />}
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {isBlocked ? 'Acesso Suspenso' : 'Solicitação em Análise'}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              {isBlocked
                ? 'Seu acesso ao sistema está suspenso. Fale com a nossa equipe comercial para renovação.'
                : 'Seu cadastro foi recebido com sucesso! Escolha o seu plano abaixo e solicite a liberação imediata via WhatsApp.'}
            </p>
          </div>

          {/* User Identification Chip */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={
                  profile?.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'U')}&background=0284c7&color=fff`
                }
                alt={profile?.name}
                className="w-10 h-10 rounded-xl border border-slate-700 object-cover shrink-0"
              />
              <div className="min-w-0">
                <div className="font-bold text-xs sm:text-sm text-white truncate">{profile?.name}</div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                  <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">{profile?.email}</span>
                </div>
              </div>
            </div>

            <span
              className={`text-[9px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider shrink-0 ${
                isBlocked
                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
              }`}
            >
              {isBlocked ? 'Suspenso' : 'Pendente'}
            </span>
          </div>

          {/* ========================================================================= */}
          {/* VITRINE DE PLANOS & PREÇOS                                                */}
          {/* ========================================================================= */}
          {!isBlocked && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-sky-400" />
                  <span>Escolha seu Plano de Assinatura:</span>
                </h3>
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Teste Grátis Disponível
                </span>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Plan 1: Profissional */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan('pro')}
                  className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                    selectedPlan === 'pro'
                      ? 'bg-sky-950/50 border-sky-500 ring-1 ring-sky-500/50 shadow-lg'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 opacity-80'
                  }`}
                >
                  <div>
                    <div className="text-[9px] font-black uppercase px-2 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 inline-block mb-1">
                      Individual
                    </div>
                    <div className="font-extrabold text-white text-xs">Profissional</div>
                    <div className="text-base font-black text-sky-400 font-mono mt-1">
                      R$ 97<span className="text-[10px] font-normal text-slate-400">/mês</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-[10px] text-slate-300">
                      <li>• 1 Usuário / Aparelho</li>
                      <li>• Mapas PDF Ilimitados</li>
                      <li>• Medição de Madeira</li>
                    </ul>
                  </div>
                  {selectedPlan === 'pro' && (
                    <div className="mt-2 text-[10px] font-bold text-sky-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Selecionado
                    </div>
                  )}
                </button>

                {/* Plan 2: Equipe (Highlight) */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan('equipe')}
                  className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                    selectedPlan === 'equipe'
                      ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/60 shadow-xl'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 opacity-80'
                  }`}
                >
                  <div className="absolute -top-2 right-2 bg-emerald-500 text-slate-950 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Mais Escolhido
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase px-2 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-block mb-1">
                      Equipe
                    </div>
                    <div className="font-extrabold text-white text-xs">Plano Equipe</div>
                    <div className="text-base font-black text-emerald-400 font-mono mt-1">
                      R$ 289<span className="text-[10px] font-normal text-slate-400">/mês</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-[10px] text-slate-300">
                      <li>• Até 5 Técnicos de Campo</li>
                      <li>• Diário de Quilometragem</li>
                      <li>• Laudos em Lote + Nuvem</li>
                    </ul>
                  </div>
                  {selectedPlan === 'equipe' && (
                    <div className="mt-2 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Selecionado
                    </div>
                  )}
                </button>

                {/* Plan 3: Florestal & Usinas */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan('florestal')}
                  className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                    selectedPlan === 'florestal'
                      ? 'bg-indigo-950/50 border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 opacity-80'
                  }`}
                >
                  <div>
                    <div className="text-[9px] font-black uppercase px-2 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 inline-block mb-1">
                      Corporativo
                    </div>
                    <div className="font-extrabold text-white text-xs">Florestal & Usinas</div>
                    <div className="text-base font-black text-indigo-400 font-mono mt-1">
                      R$ 690<span className="text-[10px] font-normal text-slate-400">/mês</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-[10px] text-slate-300">
                      <li>• 15 a 30 Operadores</li>
                      <li>• Logo da sua Empresa</li>
                      <li>• Suporte VIP Prioritário</li>
                    </ul>
                  </div>
                  {selectedPlan === 'florestal' && (
                    <div className="mt-2 text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Selecionado
                    </div>
                  )}
                </button>
              </div>

              {/* WhatsApp Activation Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 px-4 rounded-2xl shadow-xl shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-98"
                >
                  <Send className="w-4 h-4" />
                  <span>Liberar no WhatsApp / Iniciar Teste Grátis</span>
                </button>
                <p className="text-[10px] text-center text-slate-400 mt-1.5">
                  Fale com a nossa equipe para ativação imediata e orientações de uso.
                </p>
              </div>
            </div>
          )}

          {/* Secondary Actions */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            {!isBlocked && (
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={checking}
                className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-750 text-sky-400 font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                <span>{checking ? 'Verificando com o Servidor...' : 'Verificar se meu Acesso foi Liberado'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={logout}
              className="w-full py-2 text-xs text-slate-400 hover:text-white rounded-xl hover:bg-slate-850 transition-colors flex items-center justify-center gap-1.5 text-center"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair / Trocar de Conta</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-500 font-medium">
          GoField Pro • AM TST SAÚDE E SEGURANÇA DO TRABALHO
        </div>
      </div>
    </div>
  );
};
