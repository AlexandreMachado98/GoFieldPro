const fs = require('fs');

const content = `import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Language } from '../types';
import {
  Folder,
  Wifi,
  WifiOff,
  RefreshCw,
  ShieldCheck,
  Globe,
  Bell,
  ChevronDown,
  CheckCircle2,
  LogOut
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
    markNotificationAsRead,
  } = useApp();

  const { profile, logout } = useAuth();
  const [isProjectsDropdownOpen, setIsProjectsDropdownOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="bg-slate-950 border-b border-slate-800 select-none z-30 sticky top-0">
      <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2 h-14">
        {/* Left Side: Project Dropdown */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              id="btn-project-dropdown"
              onClick={() => setIsProjectsDropdownOpen(!isProjectsDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sm font-semibold text-slate-200 transition-colors"
            >
              <Folder className="w-4 h-4 text-sky-400" />
              <span className="max-w-[140px] sm:max-w-[300px] truncate">{activeProject.name}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {isProjectsDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-1.5 animate-in fade-in">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Pastas de Projetos</div>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProject(p);
                      setIsProjectsDropdownOpen(false);
                    }}
                    className={\`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors \${
                      p.id === activeProject.id ? 'bg-sky-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                    }\`}
                  >
                    <span className="truncate">{p.name}</span>
                    {p.id === activeProject.id && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 ml-1" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Tools & Profile */}
        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
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
            className={\`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border \${
              isOffline
                ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
            }\`}
          >
            {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isOffline ? t.offline : t.online}</span>
          </button>

          {/* Sync Button */}
          <button
            id="btn-navbar-sync"
            onClick={triggerManualSync}
            disabled={isSyncing}
            title={offlineQueue.length > 0 ? \`\${offlineQueue.length} \${t.pendingSync}\` : t.allSynced}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-colors"
          >
            <RefreshCw className={\`w-3.5 h-3.5 text-sky-400 \${isSyncing ? 'animate-spin' : ''}\`} />
            {offlineQueue.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            )}
          </button>

          {/* User Profile */}
          <div className="relative">
            <button
              id="btn-user-dropdown"
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              <img src={profile?.avatar} alt={profile?.name} className="w-5 h-5 rounded-full" />
              <div className="hidden lg:flex flex-col items-start leading-none">
                <span className="text-[10px] font-bold text-slate-200">{profile?.name}</span>
                <span className="text-[9px] text-sky-400 uppercase">{profile?.role.replace('_', ' ')}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {isUserDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-1.5 animate-in fade-in">
                <div className="px-3 py-2 border-b border-slate-800 mb-1">
                  <div className="text-xs font-bold text-white">{profile?.name}</div>
                  <div className="text-[10px] text-slate-400">{profile?.email}</div>
                  <div className="text-[10px] text-sky-400 uppercase mt-1 font-semibold">{profile?.role.replace('_', ' ')}</div>
                </div>
                <button
                  onClick={() => {
                    setIsUserDropdownOpen(false);
                    logout();
                  }}
                  className="w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 text-rose-400 hover:bg-rose-950/40 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sair do Sistema
                </button>
              </div>
            )}
          </div>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              id="btn-notifications-bell"
              onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors relative"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
            {isNotifDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in">
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-800">
                  <span className="text-xs font-bold text-white">Notificações de Campo</span>
                  <span className="text-[10px] text-slate-400">{notifications.length} alertas</span>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1.5 py-1">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markNotificationAsRead(n.id)}
                      className={\`p-2 rounded-xl text-xs cursor-pointer transition-colors \${
                        n.read ? 'bg-slate-900/60 text-slate-400' : 'bg-slate-800 text-slate-200 font-semibold'
                      }\`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold">{n.title}</span>
                        <span className="text-[10px] text-slate-500">{new Date(n.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
`;
fs.writeFileSync('src/components/Topbar.tsx', content);
