import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useUpdate } from '../context/UpdateContext';
import { APP_VERSION } from '../config/version';
import { Language } from '../types';
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
    currentGps,
    hasGpsLock,
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
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-2xs"
          onClick={closeAllDropdowns}
        />
      )}

      <header className="bg-[#070A10]/95 backdrop-blur-md border-b border-slate-800/80 select-none z-40 sticky top-0 relative shadow-lg shadow-black/40 pt-[env(safe-area-inset-top,0px)]">
        <div className="px-3.5 sm:px-5 py-2 flex items-center justify-between gap-3 h-14">
          {/* Left Side: Menu Trigger & App Title */}
          <div className="flex items-center gap-2.5">
            <button 
              className="p-2 -ml-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-[#0D121D] border border-transparent hover:border-slate-800 transition-colors active:scale-95 cursor-pointer"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir Menu Lateral"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tight text-white leading-none">GoField Pro</span>
              <span className="text-[10px] font-semibold text-sky-400 leading-tight truncate max-w-[140px] sm:max-w-[200px]">
                {activeProject?.name || 'Projeto Padrão'}
              </span>
            </div>
          </div>

          {/* Right Side: GPS Live Pill & Single User Profile Trigger */}
          <div className="flex items-center gap-2">
            {/* Live GPS Status Pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border shadow-xs transition-colors ${
                hasGpsLock
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-300 animate-pulse'
              }`}
              title={hasGpsLock ? `GPS Conectado (Precisão ±${currentGps?.accuracy?.toFixed(1) || '2.0'}m)` : 'Buscando sinal GPS...'}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  hasGpsLock ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-amber-400'
                }`}
              />
              <span className="text-[10px]">
                {hasGpsLock ? `±${(currentGps?.accuracy || 2.0).toFixed(0)}m` : 'GPS...'}
              </span>
            </div>

            {/* Profile Avatar Trigger (Contains all action items in dropdown) */}
            <div className="relative">
              <button
                id="btn-user-dropdown"
                onClick={() => {
                  setIsNotifDropdownOpen(false);
                  setIsUserDropdownOpen(!isUserDropdownOpen);
                }}
                className="flex items-center gap-1.5 p-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700/80 transition-all active:scale-95 cursor-pointer relative"
                title="Perfil e Configurações"
              >
                <img src={profile?.avatar} alt={profile?.name} className="w-7 h-7 rounded-full object-cover border border-slate-700" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black flex items-center justify-center animate-pulse shadow">
                    {unreadNotificationsCount}
                  </span>
                )}
                <ChevronDown className="w-3 h-3 text-slate-400 mr-1" />
              </button>

              {/* User Dropdown Menu with all integrated tools */}
              {isUserDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl z-50 p-2.5 animate-in fade-in slide-in-from-top-2 space-y-1.5 backdrop-blur-md">
                  {/* User Profile Header */}
                  <div className="px-3 py-2.5 border-b border-slate-800/80 bg-slate-950/60 rounded-xl space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="text-xs font-black text-white truncate">{profile?.name}</div>
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
                  </div>

                  {/* 1. Planos e Assinatura Pro */}
                  <button
                    onClick={() => {
                      closeAllDropdowns();
                      openUpgradeModal('Menu Usuário');
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-xs font-bold flex items-center justify-between bg-gradient-to-r from-amber-500/15 to-emerald-500/15 hover:from-amber-500/25 hover:to-emerald-500/25 border border-amber-500/40 text-amber-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Planos & Assinatura Pro</span>
                    </div>
                    <span className="text-[10px] uppercase font-black bg-amber-500/20 px-1.5 py-0.5 rounded">Ver</span>
                  </button>

                  {/* 2. Seletor de Projetos */}
                  <div className="space-y-1 pt-1 border-t border-slate-800/60">
                    <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 py-0.5 flex items-center justify-between">
                      <span>Projeto Ativo</span>
                      <Folder className="w-3 h-3 text-sky-400" />
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {projects.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setActiveProject(p);
                            closeAllDropdowns();
                            notifySuccess('Projeto Selecionado', `Alternado para "${p.name}".`);
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                            activeProject?.id === p.id
                              ? 'bg-sky-950/60 border border-sky-500/40 text-sky-300 font-bold'
                              : 'hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <span className="truncate">{p.name}</span>
                          {activeProject?.id === p.id && <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Notificações */}
                  <button
                    onClick={() => {
                      closeAllDropdowns();
                      handleOpenNotifications();
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer border-t border-slate-800/60 pt-2"
                  >
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>Central de Notificações</span>
                    </div>
                    {unreadNotificationsCount > 0 && (
                      <span className="text-[10px] font-bold bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded-full">
                        {unreadNotificationsCount} novas
                      </span>
                    )}
                  </button>

                  {/* 4. Modo Escuro / Claro Toggle */}
                  <button
                    onClick={() => {
                      toggleTheme();
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {settings.theme === 'light' ? (
                        <Moon className="w-4 h-4 text-sky-400 shrink-0" />
                      ) : (
                        <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span>{settings.theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono uppercase">{settings.theme}</span>
                  </button>

                  {/* 5. Sincronizar Dados */}
                  <button
                    onClick={() => {
                      triggerManualSync();
                    }}
                    disabled={isSyncing}
                    className="w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw className={`w-4 h-4 text-emerald-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Sincronizar Dados</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">{isSyncing ? 'Sincronizando...' : 'Nuvem'}</span>
                  </button>

                  {/* 6. Configurações */}
                  <button
                    onClick={() => {
                      closeAllDropdowns();
                      setIsSettingsModalOpen(true);
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Configurações do App</span>
                    </div>
                  </button>

                  {/* 7. Sair da Conta */}
                  <button
                    onClick={() => {
                      closeAllDropdowns();
                      handleLogout();
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer border-t border-slate-800/60"
                  >
                    <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Sair da Conta</span>
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

