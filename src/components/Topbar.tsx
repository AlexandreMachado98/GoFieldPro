import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useUpdate } from '../context/UpdateContext';
import { APP_VERSION } from '../config/version';
import { Language } from '../types';
import { PwaInstallButton } from './PWA/PwaInstallButton';
import { hasSpecialAccessActive } from '../utils/featureAccess';
import {
  Folder,
  Wifi,
  Menu,
  WifiOff,
  RefreshCw,
  ShieldCheck,
  Globe,
  Bell,
  ChevronDown,
  CheckCircle2,
  LogOut,
  Settings,
  CheckCheck,
  Trash2,
  Sun,
  Moon,
  Sparkles,
  Crown,
  Zap
} from 'lucide-react';

export const Topbar: React.FC = () => {
  const {
    language,
    setLanguage,
    t,
    projects,
    activeProject,
    setActiveProject,
    isOffline,
    setIsOffline,
    isSyncing,
    triggerManualSync,
    offlineQueue,
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllNotifications,
    setIsMobileMenuOpen,
    setIsSettingsModalOpen,
    settings,
    toggleTheme,
    showConfirm,
    openUpgradeModal,
    notifyInfo,
    notifySuccess,
    isProUser,
  } = useApp();

  const { profile, logout } = useAuth();
  const { 
    isUpdateAvailable, 
    latestVersion, 
    isCheckingUpdate, 
    isApplyingUpdate, 
    checkForUpdates, 
    applyUpdate, 
    forceCleanUpdate 
  } = useUpdate();
  const [isProjectsDropdownOpen, setIsProjectsDropdownOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const handleOpenNotifications = () => {
    setIsUserDropdownOpen(false);
    const nextState = !isNotifDropdownOpen;
    setIsNotifDropdownOpen(nextState);
    if (nextState) {
      // Automatically mark all as read so the alert indicator badge disappears immediately
      markAllNotificationsAsRead();
    }
  };

  const handleLogout = async () => {
    closeAllDropdowns();
    await logout();
  };

  const closeAllDropdowns = () => {
    setIsNotifDropdownOpen(false);
    setIsUserDropdownOpen(false);
    setIsProjectsDropdownOpen(false);
    setIsLangDropdownOpen(false);
  };

  return (
    <>
      {/* Backdrop for open dropdowns to guarantee closing and isolate clicks */}
      {(isNotifDropdownOpen || isUserDropdownOpen || isProjectsDropdownOpen || isLangDropdownOpen) && (
        <div
          className="fixed inset-0 z-[95000] bg-black/20 backdrop-blur-2xs"
          onClick={closeAllDropdowns}
        />
      )}

      <header className="bg-[#070A10]/95 backdrop-blur-md border-b border-slate-800/80 select-none z-[96000] sticky top-0 relative shadow-lg shadow-black/40">
        <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2 h-14">
          {/* Left Side: Menu Trigger & App Title */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              className="p-2 -ml-1 text-slate-300 hover:text-white rounded-xl hover:bg-[#0D121D] border border-transparent hover:border-slate-800 transition-colors active:scale-95 cursor-pointer"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir Menu Lateral"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block pl-2 border-l border-slate-800/80">
               <h1 className="text-sm font-bold text-white tracking-tight">GoField <span className="text-emerald-400">Pro</span></h1>
            </div>
          </div>

          {/* Right Side: Clean Topbar (1. Coroa Pro, 2. Modo Escuro/Claro, 3. Notificações, 4. Perfil) */}
          <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
            {/* 1. Botão de Planos & Assinatura Pro no Topbar */}
            <button
              onClick={() => openUpgradeModal('Adesão / Upgrade')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-emerald-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 border border-amber-500/40 text-amber-300 text-xs font-black transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Ver Planos e Assinaturas"
            >
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Planos Pro</span>
            </button>

            {/* 2. Modo Escuro / Claro Toggle */}
            <button
              id="btn-theme-toggle"
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-[#0D121D] hover:bg-slate-850 border border-slate-800/80 text-slate-300 hover:text-white transition-colors active:scale-95 cursor-pointer shadow-sm"
              title={settings.theme === 'light' ? 'Mudar para Modo Escuro' : 'Mudar para Modo Claro (Alta Visibilidade)'}
              aria-label="Alternar Tema Claro e Escuro"
            >
              {settings.theme === 'light' ? (
                <Moon className="w-4 h-4 text-indigo-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>

            {/* 3. Central de Notificações */}
            <div className="relative">
              <button
                id="btn-notifications-bell"
                onClick={handleOpenNotifications}
                className="p-2 rounded-xl bg-[#0D121D] hover:bg-slate-850 border border-slate-800/80 text-slate-200 transition-colors relative active:scale-95 cursor-pointer shadow-sm"
                title="Notificações"
              >
                <Bell className="w-4 h-4 text-slate-300" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black flex items-center justify-center animate-pulse shadow">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>
              {isNotifDropdownOpen && (
                <div className="fixed sm:absolute top-14 right-2 sm:right-0 sm:mt-2 w-[calc(100vw-1rem)] max-w-sm sm:w-84 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[96000] p-2.5 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between px-2 py-2 border-b border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-bold text-white">Central de Notificações</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={markAllNotificationsAsRead}
                        className="text-[10px] text-sky-400 hover:text-sky-300 p-1 rounded hover:bg-slate-800 font-semibold"
                        title="Marcar todas como lidas"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                      {notifications.length > 0 && (
                        <button
                          onClick={clearAllNotifications}
                          className="text-[10px] text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-800"
                          title="Limpar todas as notificações"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-1.5 py-1.5">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        Nenhuma notificação no momento.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markNotificationAsRead(n.id)}
                          className={`p-2.5 rounded-xl text-xs cursor-pointer transition-colors border ${
                            n.read
                              ? 'bg-slate-950/40 border-slate-800/40 text-slate-400'
                              : 'bg-slate-800/90 border-slate-700/80 text-slate-200 font-semibold shadow-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-white font-bold truncate">{n.title}</span>
                            <span className="text-[10px] text-slate-500 shrink-0">
                              {new Date(n.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Menu do Usuário & Configurações */}
            <div className="relative">
              <button
                id="btn-user-dropdown"
                onClick={() => {
                  setIsNotifDropdownOpen(false);
                  setIsUserDropdownOpen(!isUserDropdownOpen);
                }}
                className="flex items-center gap-2 p-1.5 sm:px-2 sm:py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
                title="Menu do Usuário"
              >
                <img src={profile?.avatar} alt={profile?.name} className="w-6 h-6 rounded-full object-cover border border-slate-700" />
                <div className="hidden lg:flex flex-col items-start leading-none">
                  <span className="text-[11px] font-bold text-slate-200">{profile?.name}</span>
                  <span className="text-[9px] text-sky-400 uppercase font-semibold">{profile?.role.replace('_', ' ')}</span>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {isUserDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[96000] p-2 animate-in fade-in slide-in-from-top-2 space-y-1">
                  <div className="px-3 py-2.5 border-b border-slate-800 mb-1 bg-slate-950/60 rounded-xl space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="text-xs font-bold text-white truncate">{profile?.name}</div>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        profile?.role === 'super_admin'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : hasSpecialAccessActive(profile)
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : isProUser
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                      }`}>
                        {profile?.role === 'super_admin'
                          ? 'Super Admin'
                          : hasSpecialAccessActive(profile)
                          ? '🔑 Acesso Especial'
                          : isProUser
                          ? 'Plano Pro'
                          : 'Plano Free'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{profile?.email}</div>
                    {!isProUser && profile?.role !== 'super_admin' && (
                      <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 mt-1">
                        <span>Limite: 2 Mapas PDF</span>
                        <button
                          type="button"
                          onClick={() => {
                            closeAllDropdowns();
                            openUpgradeModal('Upgrade Pro');
                          }}
                          className="text-amber-400 font-bold hover:underline cursor-pointer"
                        >
                          Fazer Upgrade
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 1. Botão de Instalar App (PWA) no menu do perfil */}
                  <div className="pb-1">
                    <PwaInstallButton variant="sidebar" />
                  </div>

                  {/* 2. Botão de Sincronização de Dados no menu do perfil */}
                  <button
                    onClick={() => {
                      triggerManualSync();
                    }}
                    disabled={isSyncing}
                    className="w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between bg-slate-950/40 hover:bg-slate-850 border border-slate-800 text-slate-200 transition-all cursor-pointer mb-1"
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw className={`w-4 h-4 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Sincronizar Nuvem</span>
                    </div>
                    {offlineQueue.length > 0 ? (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {offlineQueue.length} pendentes
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Atualizado
                      </span>
                    )}
                  </button>

                  {/* 3. Online / Offline Toggle within user menu */}
                  <button
                    onClick={() => {
                      setIsOffline(!isOffline);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
                      isOffline
                        ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                        : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isOffline ? <WifiOff className="w-4 h-4 text-amber-400" /> : <Wifi className="w-4 h-4 text-emerald-400" />}
                      <span>Modo de Operação</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase">{isOffline ? 'Offline' : 'Online'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      setIsSettingsModalOpen(true);
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-sky-400" />
                    <span>Configurações do Sistema</span>
                  </button>

                  {/* App Version Info / Update Action in User Dropdown */}
                  {isUpdateAvailable ? (
                    <button
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        applyUpdate();
                      }}
                      className="w-full text-left p-2.5 rounded-xl text-xs font-bold flex items-center justify-between bg-sky-950/60 border border-sky-500 text-sky-300 hover:bg-sky-900/60 transition-all animate-pulse"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Atualizar ({latestVersion})</span>
                      </div>
                      <span className="text-[10px] bg-sky-500 text-slate-950 px-2 py-0.5 rounded-full font-black">
                        Novo
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        setIsUserDropdownOpen(false);
                        notifyInfo('Verificando Atualizações', 'Conectando ao servidor...');
                        const hasNew = await checkForUpdates(true);
                        if (hasNew) {
                          notifySuccess('Nova Versão Encontrada!', `A versão ${latestVersion} está pronta.`);
                          showConfirm({
                            title: `Instalar Atualização (${latestVersion})?`,
                            message: 'O aplicativo será atualizado e o cache antigo será eliminado para evitar conflitos. Todos os seus dados locais continuarão intactos.',
                            type: 'info',
                            confirmText: 'Atualizar Agora',
                            onConfirm: applyUpdate,
                          });
                        } else {
                          notifySuccess('Aplicativo Atualizado', `Você já está na versão mais recente (${APP_VERSION}).`);
                          showConfirm({
                            title: 'Limpar Cache & Sincronizar?',
                            message: 'Deseja forçar a eliminação de arquivos antigos em cache e recarregar o sistema? Seus dados locais permanecem 100% seguros e intactos.',
                            type: 'info',
                            confirmText: 'Limpar Cache & Recarregar',
                            onConfirm: forceCleanUpdate,
                          });
                        }
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between text-sky-300 bg-sky-950/40 border border-sky-500/40 hover:bg-sky-900/50 hover:border-sky-400 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <RefreshCw className={`w-4 h-4 text-sky-400 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                        <span>Verificar Atualizações</span>
                      </div>
                      <span className="font-mono text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {APP_VERSION}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 text-rose-400 hover:bg-rose-950/40 transition-colors border-t border-slate-800/60 pt-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair do Aplicativo</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

