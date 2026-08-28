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
  RefreshCw,
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
    notifyInfo,
    notifySuccess,
    showConfirm,
  } = useApp();
  const { profile, logout } = useAuth();
  const isOwnerAdmin = profile?.role === 'super_admin' || profile?.email?.toLowerCase() === 'alexandre1604981@gmail.com';
  const isSuperAdmin = isOwnerAdmin;
  const hasFullProAccess = isOwnerAdmin || isProUser;
  const { 
    isUpdateAvailable, 
    latestVersion, 
    isCheckingUpdate, 
    isApplyingUpdate, 
    checkForUpdates, 
    applyUpdate, 
    forceCleanUpdate 
  } = useUpdate();
  const [pendingCount, setPendingCount] = useState(0);

  const activeFireCount = (fireIncidents || []).filter((i) => i && i.status === 'em_combate').length;

  const handleCheckUpdates = async () => {
    if (isCheckingUpdate || isApplyingUpdate) return;
    notifyInfo('Verificando Atualizações', 'Conectando ao servidor para checar novas versões...');
    const hasUpdate = await checkForUpdates(true);
    if (hasUpdate) {
      notifySuccess('Nova Versão Disponível!', `A versão ${latestVersion} está disponível.`);
      showConfirm({
        title: `Instalar Atualização (${latestVersion})?`,
        message: 'O aplicativo será atualizado e o cache antigo será eliminado para evitar conflitos de versão. Todos os seus pontos, mapas e dados locais serão preservados.',
        type: 'info',
        confirmText: 'Atualizar Agora',
        onConfirm: applyUpdate,
      });
    } else {
      notifySuccess('Aplicativo Atualizado', `Você já está executando a versão mais recente (${APP_VERSION}).`);
      showConfirm({
        title: 'Limpar Cache & Sincronizar?',
        message: 'Deseja forçar a eliminação de arquivos antigos em cache e recarregar o sistema? Todos os seus pontos, mapas e configurações de usuário permanecerão 100% intactos.',
        type: 'info',
        confirmText: 'Limpar Cache & Recarregar',
        onConfirm: forceCleanUpdate,
      });
    }
  };

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
    { id: 'field_rounds', label: t.tabFieldRounds || 'Registrar Atividade', icon: Gauge, isPremium: true },
    { id: 'offline', label: t.tabOffline || 'Mapas Offline', icon: HardDrive },
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
          fixed md:relative inset-y-0 left-0 bg-[#070A10] border-r border-slate-800/80 flex flex-col h-[100dvh] z-[99999] md:z-30 shadow-2xl transition-all duration-300 ease-in-out select-none
          ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
          ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64 lg:w-72'}
        `}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800/80 flex items-center justify-between bg-[#070A10] shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-950/50 shrink-0">
              <Map className="w-5 h-5" />
            </div>
            {(!isSidebarCollapsed || isMobileMenuOpen) && (
              <div className="truncate">
                <h1 className="text-base font-extrabold text-white tracking-tight leading-none truncate">
                  GoField <span className="text-emerald-400">Pro</span>
                </h1>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">Navegação & Campo</p>
              </div>
            )}
          </div>

          {/* Close button on Mobile */}
          <button
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Fechar Menu"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Collapse/Expand Toggle on Desktop */}
          <button
            onClick={toggleSidebarCollapsed}
            className="hidden md:flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
            title={isSidebarCollapsed ? 'Expandir Barra Lateral' : 'Minimizar Barra Lateral'}
          >
            {isSidebarCollapsed ? <PanelLeft className="w-5 h-5 text-emerald-400" /> : <PanelLeftClose className="w-5 h-5" />}
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
                  if ((tab as any).isPremium && !hasFullProAccess) {
                    openUpgradeModal(tab.label);
                    return;
                  }
                  setActiveTab(tab.id as any);
                  setIsMobileMenuOpen(false);
                }}
                title={isCollapsed ? tab.label : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3.5 py-3'
                } rounded-xl text-sm font-extrabold transition-all active:scale-98 relative group cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-950/60 ring-1 ring-emerald-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-[#0D121D] border border-transparent hover:border-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive ? 'text-white' : tab.iconColor || 'text-emerald-400'
                    }`}
                  />
                  {!isCollapsed && (
                    <div className="flex items-center justify-between gap-2 w-full truncate">
                      <span className="truncate">{tab.label}</span>
                      {(tab as any).isPremium && !isSuperAdmin && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm shrink-0">
                          <Lock className="w-2.5 h-2.5 text-amber-400" />
                          PREMIUM
                        </span>
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
                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border flex items-center gap-1 shadow-sm ${
                  !isSuperAdmin 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {!isSuperAdmin && <Lock className="w-2.5 h-2.5 text-amber-400" />}
                  {!isSuperAdmin ? 'PREMIUM' : 'm³'}
                </span>
              )}
            </button>

            {/* Planos & Assinatura Pro */}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                openUpgradeModal('Planos de Assinatura');
              }}
              title={isSidebarCollapsed && !isMobileMenuOpen ? 'Planos & Assinatura Pro' : undefined}
              className={`w-full flex items-center ${
                isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5'
              } rounded-xl text-xs font-black text-amber-300 bg-gradient-to-r from-amber-500/20 via-sky-500/20 to-amber-500/20 border border-amber-500/40 hover:from-amber-500/30 hover:to-sky-500/30 transition-all active:scale-98 cursor-pointer shadow-sm`}
            >
              <div className="flex items-center gap-3">
                <Crown className="w-5 h-5 text-amber-400 shrink-0" />
                {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Planos & Assinaturas</span>}
              </div>
              {(!isSidebarCollapsed || isMobileMenuOpen) && (
                <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 flex items-center gap-0.5 shadow">
                  <Zap className="w-2.5 h-2.5 fill-current" />
                  PRO
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

            {/* Check for Updates & Cache Purge */}
            <button
              type="button"
              onClick={handleCheckUpdates}
              disabled={isCheckingUpdate || isApplyingUpdate}
              title={isSidebarCollapsed && !isMobileMenuOpen ? 'Verificar Atualizações & Limpar Cache' : undefined}
              className={`w-full flex items-center ${
                isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5'
              } rounded-xl text-xs font-bold text-sky-400 bg-sky-950/20 hover:text-sky-300 hover:bg-sky-950/40 border border-sky-500/30 transition-all active:scale-98 cursor-pointer disabled:opacity-50`}
            >
              <div className="flex items-center gap-3">
                <RefreshCw className={`w-5 h-5 text-sky-400 shrink-0 ${isCheckingUpdate || isApplyingUpdate ? 'animate-spin' : ''}`} />
                {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Verificar Atualizações</span>}
              </div>
              {(!isSidebarCollapsed || isMobileMenuOpen) && (
                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border flex items-center gap-1 shadow-sm ${
                  isUpdateAvailable
                    ? 'bg-amber-500 text-slate-950 border-amber-400 animate-bounce'
                    : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                }`}>
                  {isCheckingUpdate ? 'Checando...' : isUpdateAvailable ? 'Nova Versão' : 'Checar'}
                </span>
              )}
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
          {/* Check Updates Button in Footer */}
          <button
            type="button"
            onClick={handleCheckUpdates}
            disabled={isCheckingUpdate || isApplyingUpdate}
            title={isSidebarCollapsed && !isMobileMenuOpen ? 'Verificar Atualizações & Limpar Cache' : undefined}
            className={`w-full flex items-center ${
              isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
            } rounded-xl bg-gradient-to-r from-sky-950/80 to-slate-900 border border-sky-500/40 text-sky-300 hover:text-white hover:border-sky-400 text-xs font-bold transition-all active:scale-98 shadow-sm cursor-pointer disabled:opacity-50`}
          >
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-sky-400 shrink-0 ${isCheckingUpdate || isApplyingUpdate ? 'animate-spin' : ''}`} />
              {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Verificar Atualizações</span>}
            </div>
            {(!isSidebarCollapsed || isMobileMenuOpen) && (
              <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${
                isUpdateAvailable
                  ? 'bg-amber-500 text-slate-950 border-amber-400 animate-bounce'
                  : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
              }`}>
                {isCheckingUpdate ? '...' : isUpdateAvailable ? 'Novo' : 'Checar'}
              </span>
            )}
          </button>

          {/* Update Available Badge */}
          {isUpdateAvailable && (!isSidebarCollapsed || isMobileMenuOpen) && (
            <button
              type="button"
              onClick={applyUpdate}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-sky-600/30 to-emerald-600/30 border border-sky-500/50 text-sky-300 text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 animate-pulse cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Instalar {latestVersion}</span>
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
              onClick={handleCheckUpdates}
              title="Clique para checar atualizações e limpar cache"
              className="w-full flex items-center justify-between text-[10px] text-slate-400 hover:text-slate-200 px-1 py-0.5 rounded transition-colors group cursor-pointer"
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
