import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useUpdate } from '../context/UpdateContext';
import { APP_VERSION } from '../config/version';
import { PwaInstallButton } from './PWA/PwaInstallButton';
import {
  Map,
  Crown,
  Lock,
  Zap,
  Home,
  HardDrive,
  UserCog,
  Gauge,
  FileText,
  Settings,
  LogOut,
  X,
  Sparkles,
  Trees,
  ShieldCheck,
  Flame,
  PanelLeftClose,
  PanelLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    t,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isSidebarCollapsed,
    toggleSidebarCollapsed,
    setIsSettingsModalOpen,
    setIsWoodpileModalOpen,
    setIsPoliciesModalOpen,
    fireIncidents,
    isProUser,
    openUpgradeModal,
    billingConfig,
  } = useApp();
  const { profile, logout } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin' || profile?.email?.toLowerCase() === 'alexandre1604981@gmail.com' || isProUser;
  const { isUpdateAvailable, latestVersion, applyUpdate } = useUpdate();
  const [pendingCount, setPendingCount] = useState(0);

  const activeFireCount = (fireIncidents || []).filter((i) => i && i.status === 'em_combate').length;

  useEffect(() => {
    if (profile?.role !== 'super_admin') return;

    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        let count = 0;
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.status === 'pending') {
            count++;
          }
        });
        setPendingCount(count);
      },
      (err) => {
        console.warn('Sidebar pending count listener:', err.message);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  const handleLogout = async () => {
    setIsMobileMenuOpen(false);
    await logout();
  };

  interface TabItem {
    id: string;
    label: string;
    icon: React.ElementType;
    badge?: number;
    badgeColor?: string;
    iconColor?: string;
    isPremium?: boolean;
  }

  const tabs: TabItem[] = [
    { id: 'home', label: t.tabHome || 'Início', icon: Home },
    { id: 'map', label: t.tabMap || 'Mapa de Navegação', icon: Map },
    { id: 'pdf_maps', label: t.tabPdfMaps || 'Mapas & Plantas PDF', icon: FileText },
    { id: 'field_rounds', label: t.tabFieldRounds || 'Registrar Atividade', icon: Gauge },
    { id: 'offline', label: t.tabOffline || 'Mapas Offline', icon: HardDrive, isPremium: true },
  ];

  if (profile?.role === 'super_admin') {
    tabs.push({ id: 'admin', label: 'Admin & Equipe', icon: UserCog, badge: pendingCount, badgeColor: 'bg-amber-500' });
  }

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-xs z-[99998] transition-opacity cursor-pointer"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Sidebar: Responsive Drawer on Mobile, Collapsible Permanent Bar on Desktop */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 bg-slate-950 border-r border-slate-800 flex flex-col h-[100dvh] z-[99999] md:z-30 shadow-2xl transition-all duration-300 ease-in-out select-none
          ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
          ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64 lg:w-72'}
        `}
      >
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 via-emerald-500 to-rose-500 flex items-center justify-center text-white shadow-lg shrink-0">
              <Map className="w-5 h-5" />
            </div>
            {(!isSidebarCollapsed || isMobileMenuOpen) && (
              <div className="truncate">
                <h1 className="text-base font-extrabold text-white tracking-tight leading-none truncate">
                  GoField <span className="text-sky-400">Pro</span>
                </h1>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">Navegação & Campo</p>
              </div>
            )}
          </div>

          {/* Close button on Mobile */}
          <button
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors active:scale-95"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Fechar Menu"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Collapse/Expand Toggle on Desktop */}
          <button
            onClick={toggleSidebarCollapsed}
            className="hidden md:flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors active:scale-95"
            title={isSidebarCollapsed ? 'Expandir Barra Lateral' : 'Minimizar Barra Lateral'}
          >
            {isSidebarCollapsed ? <PanelLeft className="w-5 h-5 text-sky-400" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 sm:px-3 space-y-1.5 pb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === (tab.id as any);
            const badgeCount = tab.badge || 0;
            const isCollapsed = isSidebarCollapsed && !isMobileMenuOpen;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  if ((tab as any).isPremium && !isSuperAdmin) {
                    openUpgradeModal(tab.label);
                    return;
                  }
                  setActiveTab(tab.id as any);
                  setIsMobileMenuOpen(false);
                }}
                title={isCollapsed ? tab.label : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3.5 py-3'
                } rounded-xl text-sm font-extrabold transition-all active:scale-98 relative group ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-950/50'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive ? 'text-white' : tab.iconColor || 'text-sky-400'
                    }`}
                  />
                  {!isCollapsed && (
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate">{tab.label}</span>
                      {(tab as any).isPremium && !isSuperAdmin && (
                        <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                    </div>
                  )}
                </div>

                {badgeCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black text-white shadow-md animate-pulse ${
                      tab.badgeColor || 'bg-amber-500'
                    } ${isCollapsed ? 'absolute -top-1 -right-1 w-4 h-4 p-0 flex items-center justify-center text-[9px]' : ''}`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}

          {/* Forestry Tools & Settings Section */}
          <div className="pt-3 border-t border-slate-900 space-y-1.5">
            {/* Woodpile Cubage */}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (!isSuperAdmin) {
                  openUpgradeModal('Cubagem Florestal (m³)');
                  return;
                }
                setIsWoodpileModalOpen(true);
              }}
              title={isSidebarCollapsed && !isMobileMenuOpen ? 'Cubagem Florestal (m³)' : undefined}
              className={`w-full flex items-center ${
                isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5'
              } rounded-xl text-xs font-extrabold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/40 transition-all active:scale-98`}
            >
              <div className="flex items-center gap-3">
                <Trees className="w-5 h-5 text-emerald-400 shrink-0" />
                {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Cubagem Florestal</span>}
              </div>
              {(!isSidebarCollapsed || isMobileMenuOpen) && (
                <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded-full ${
                  !isSuperAdmin ? 'bg-amber-500 text-slate-950 flex items-center gap-0.5' : 'bg-emerald-500 text-slate-950'
                }">
                  {!isSuperAdmin && <Lock className="w-2.5 h-2.5" />}
                  m³
                </span>
              )}
            </button>

            {/* Settings */}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsSettingsModalOpen(true);
              }}
              title={isSidebarCollapsed && !isMobileMenuOpen ? 'Configurações' : undefined}
              className={`w-full flex items-center ${
                isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'
              } rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900/80 transition-all active:scale-98`}
            >
              <Settings className="w-5 h-5 text-sky-400 shrink-0" />
              {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Configurações</span>}
            </button>

            {/* Policies */}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsPoliciesModalOpen(true);
              }}
              title={isSidebarCollapsed && !isMobileMenuOpen ? 'Políticas & LGPD' : undefined}
              className={`w-full flex items-center ${
                isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'
              } rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900/80 transition-all active:scale-98`}
            >
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Políticas & LGPD</span>}
            </button>

            {(!isSidebarCollapsed || isMobileMenuOpen) && <PwaInstallButton variant="sidebar" />}

          {/* Pro Upgrade Banner for Free Users */}
          {!isSuperAdmin && (!isSidebarCollapsed || isMobileMenuOpen) && (
            <div className="p-2.5 bg-gradient-to-br from-amber-500/10 via-sky-500/10 to-transparent border border-amber-500/30 rounded-2xl space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black text-white">GoField Pro</span>
                </div>
                <span className="text-[9px] font-extrabold bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-full">
                  {billingConfig?.proDiscountBadge || '54% OFF'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Mapas PDF ilimitados, cubagem de madeira e mapas offline.
              </p>
              <button
                type="button"
                onClick={() => openUpgradeModal()}
                className="w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Assinar R$ {((billingConfig?.proLaunchPrice ?? 44.99)).toFixed(2).replace('.', ',')}/mês</span>
              </button>
            </div>
          )}

          </div>
        </nav>

        {/* Footer */}
        <div className="p-2.5 sm:p-3 border-t border-slate-800/80 bg-slate-950 shrink-0 space-y-2">
          {/* Update Available Badge */}
          {isUpdateAvailable && (!isSidebarCollapsed || isMobileMenuOpen) && (
            <button
              type="button"
              onClick={applyUpdate}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-sky-600/30 to-emerald-600/30 border border-sky-500/50 text-sky-300 text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 animate-pulse"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Atualização {latestVersion}</span>
              </div>
              <span className="text-[10px] bg-sky-500 text-slate-950 px-2 py-0.5 rounded-full font-black">
                Instalar
              </span>
            </button>
          )}

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            title={isSidebarCollapsed && !isMobileMenuOpen ? 'Sair do Aplicativo' : undefined}
            className={`w-full flex items-center ${
              isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center p-2.5' : 'justify-center gap-2 px-3 py-2.5'
            } rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/60 text-rose-300 hover:text-rose-200 text-xs font-bold transition-all active:scale-98`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Sair</span>}
          </button>

          {/* App Version Info */}
          {(!isSidebarCollapsed || isMobileMenuOpen) && (
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsSettingsModalOpen(true);
              }}
              className="w-full flex items-center justify-between text-[10px] text-slate-400 hover:text-slate-200 px-1 py-0.5 rounded transition-colors group"
            >
              <span className="font-semibold text-slate-500 group-hover:text-slate-400">GoField Pro</span>
              <span className="flex items-center gap-1.5 font-mono text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {APP_VERSION}
              </span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
