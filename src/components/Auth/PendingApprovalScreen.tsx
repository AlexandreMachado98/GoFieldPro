import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Clock, RefreshCw, LogOut, CheckCircle2, UserCheck, PhoneCall, Mail } from 'lucide-react';

export const PendingApprovalScreen: React.FC = () => {
  const { profile, logout, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    refreshProfile();
  }, []);

  const handleCheckStatus = async () => {
    setChecking(true);
    await refreshProfile();
    setTimeout(() => {
      setChecking(false);
    }, 800);
  };

  const isBlocked = profile?.status === 'blocked';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[15%] left-[10%] w-[45%] h-[45%] rounded-full bg-amber-500/10 blur-[130px]"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-sky-500/10 blur-[130px]"></div>
      </div>

      <div className="w-full max-w-lg z-10">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Header Icon */}
          <div className="text-center space-y-3">
            <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-xl ${
              isBlocked ? 'bg-rose-950 border border-rose-800 text-rose-400' : 'bg-amber-950 border border-amber-800 text-amber-400'
            }`}>
              {isBlocked ? <ShieldAlert className="w-8 h-8" /> : <Clock className="w-8 h-8 animate-pulse" />}
            </div>

            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              {isBlocked ? 'Acesso Bloqueado' : 'Aguardando Liberação'}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
              {isBlocked
                ? 'Seu acesso ao sistema foi suspenso pelo administrador. Entre em contato com a equipe responsável.'
                : 'Sua solicitação de cadastro foi registrada com sucesso e aguarda liberação pelo Administrador do sistema.'}
            </p>
          </div>

          {/* User Request Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <img
                src={profile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'U')}`}
                alt={profile?.name}
                className="w-11 h-11 rounded-full border border-slate-700 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-white truncate">{profile?.name}</div>
                <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{profile?.email}</span>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${
                isBlocked
                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                  : 'bg-amber-950 text-amber-300 border-amber-800'
              }`}>
                {isBlocked ? 'Bloqueado' : 'Pendente'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Perfil Solicitado</span>
                <span className="font-semibold text-slate-200">
                  {profile?.requestedRole === 'field_lead' ? 'Líder de Campo' :
                   profile?.requestedRole === 'auditor' ? 'Auditor' : 'Coletor de Campo'}
                </span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Sincronização</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Tempo Real Ativo
                </span>
              </div>
            </div>
          </div>

          {/* Info note */}
          {!isBlocked && (
            <div className="bg-sky-950/40 border border-sky-800/50 rounded-2xl p-3.5 flex items-start gap-3">
              <UserCheck className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              <p className="text-xs text-sky-200/90 leading-relaxed">
                Você não precisa fechar o aplicativo. Assim que o administrador liberar seu usuário no painel, esta tela se desbloqueará automaticamente.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            {!isBlocked && (
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={checking}
                className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                <span>{checking ? 'Verificando com o Servidor...' : 'Verificar Status de Liberação'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={logout}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair / Trocar de Conta</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-slate-500">
          GoField Pro • Sistema de Georreferenciamento e Auditoria
        </div>
      </div>
    </div>
  );
};
