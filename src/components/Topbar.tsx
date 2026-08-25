import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Language } from '../types';
import { PwaInstallButton } from './PWA/PwaInstallButton';
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
  Moon
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
    showConfirm
  } = useApp();

  const { profile, logout } = useAuth();
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

      <header className="bg-slate-950 border-b border-slate-800 select-none z-[96000] sticky top-0 relative">
        <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2 h-14">
          {/* Left Side: Menu Trigger & App Title */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              className="p-2 -ml-1 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors active:scale-95"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir Menu Lateral"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block pl-2 border-l border-slate-800">
               <h1 className="text-sm font-bold text-white tracking-tight">GoField <span className="text-sky-400">Pro</span></h1>
            </div>
          </div>

          {/* Right Side: Tools, Settings, Notifications & Profile & Logout */}
          <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
            {/* PWA Install Button */}
            <PwaInstallButton variant="topbar" />

            {/* E2EE Badge */}
            <button
              className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-900 border border-slate-800 text-slate-500"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>E2EE (AES-256)</span>
            </button>

            {/* Offline / Online Toggle */}
            <button
              id="btn-toggle-online-offline"
              onClick={() => setIsOffline(!isOffline)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                isOffline
                  ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                  : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              }`}
            >
              {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isOffline ? t.offline : t.online}</span>
            </button>

            {/* Sync Button */}
            <button
              id="btn-navbar-sync"
              onClick={triggerManualSync}
              disabled={isSyncing}
              title={offlineQueue.length > 0 ? `${offlineQueue.length} ${t.pendingSync}` : t.allSynced}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-colors active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isSyncing ? 'animate-spin' : ''}`} />
              {offlineQueue.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              )}
            </button>

            {/* Theme Toggle Button (Light / Dark mode) */}
            <button
              id="btn-theme-toggle"
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors active:scale-95"
              title={settings.theme === 'light' ? 'Mudar para Modo Escuro' : 'Mudar para Modo Claro (Alta Visibilidade)'}
              aria-label="Alternar Tema Claro e Escuro"
            >
              {settings.theme === 'light' ? (
                <Moon className="w-4 h-4 text-indigo-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>

            {/* Settings Button */}
            <button
              id="btn-app-settings"
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors active:scale-95"
              title="Configurações do Aplicativo"
              aria-label="Abrir Configurações"
            >
              <Settings className="w-4 h-4 text-sky-400" />
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                id="btn-notifications-bell"
                onClick={handleOpenNotifications}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors relative active:scale-95"
                title="Notificações"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
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

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                id="btn-user-dropdown"
                onClick={() => {
                  setIsNotifDropdownOpen(false);
                  setIsUserDropdownOpen(!isUserDropdownOpen);
                }}
                className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
              >
                <img src={profile?.avatar} alt={profile?.name} className="w-5 h-5 rounded-full object-cover" />
                <div className="hidden lg:flex flex-col items-start leading-none">
                  <span className="text-[10px] font-bold text-slate-200">{profile?.name}</span>
                  <span className="text-[9px] text-sky-400 uppercase">{profile?.role.replace('_', ' ')}</span>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {isUserDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[96000] p-2 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1 bg-slate-950/50 rounded-xl">
                    <div className="text-xs font-bold text-white">{profile?.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{profile?.email}</div>
                    <div className="text-[10px] text-sky-400 uppercase mt-1 font-semibold">{profile?.role.replace('_', ' ')}</div>
                  </div>

                  <button
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      setIsSettingsModalOpen(true);
                    }}
                    className="w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-sky-400" />
                    Configurações
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 text-rose-400 hover:bg-rose-950/40 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair do Aplicativo
                  </button>
                </div>
              )}
            </div>

            {/* Direct Logout Button (High Visibility) */}
            <button
              id="btn-direct-logout"
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/60 text-rose-300 hover:text-rose-200 text-xs font-bold transition-all active:scale-95"
              title="Sair da Conta / Desconectar"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
};

