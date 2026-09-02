import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useUpdate } from '../context/UpdateContext';
import { APP_VERSION } from '../config/version';
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
    hasFeatureAccess,
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
          className="md:hidden fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[90] transition-opacity cursor-pointer"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Sidebar: Responsive Drawer on Mobile, Collapsible Permanent Bar on Desktop */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 bg-[#070A10] border-r border-slate-800/80 flex flex-col h-[100dvh] z-[100] md:z-30 shadow-2xl transition-all duration-300 ease-in-out select-none pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]
          ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
          ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64 lg:w-72'}
        `}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800/80 flex items-center justify-between bg-[#070A10] shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl overflow-hidden shadow-lg shadow-emerald-950/50 shrink-0 border border-emerald-500/30">
              <img src="/app-icon.png" alt="GoField Pro" className="w-full h-full object-cover" />
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
                } rounded-xl text-sm font-bold transition-all active:scale-98 relative group cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900/90 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  {!isCollapsed && (
                    <div className="flex items-center justify-between gap-2 w-full truncate">
                      <span className="truncate">{tab.label}</span>
                      {(tab as any).isPremium && !hasFeatureAccess(tab.id) && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0">
                          <Lock className="w-2.5 h-2.5 text-amber-400" />
                          PRO
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {badgeCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-md ${
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
                if (!hasFeatureAccess('woodpile_cubage')) {
                  openUpgradeModal('Cubagem Florestal de Madeira (m³)');
                  return;
                }
                setIsWoodpileModalOpen(true);
              }}
              title={isSidebarCollapsed && !isMobileMenuOpen ? 'Cubagem Florestal (m³)' : undefined}
              className={`w-full flex items-center ${
                isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5'
              } rounded-xl text-xs font-semibold text-slate-200 bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-850 transition-all active:scale-98 cursor-pointer`}
            >
              <div className="flex items-center gap-3">
                <Trees className="w-5 h-5 text-emerald-400 shrink-0" />
                {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Cubagem Florestal</span>}
              </div>
              {(!isSidebarCollapsed || isMobileMenuOpen) && (
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${
                  !hasFeatureAccess('woodpile_cubage')
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}>
                  {!hasFeatureAccess('woodpile_cubage') && <Lock className="w-2.5 h-2.5 text-amber-400" />}
                  {!hasFeatureAccess('woodpile_cubage') ? 'PRO' : 'm³'}
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
              } rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900/80 transition-all active:scale-98`}
            >
              <Settings className="w-5 h-5 text-slate-400 shrink-0" />
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
              } rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900/80 transition-all active:scale-98`}
            >
              <ShieldCheck className="w-5 h-5 text-slate-400 shrink-0" />
              {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Políticas & LGPD</span>}
            </button>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-2.5 sm:p-3 border-t border-slate-800/80 bg-slate-950 shrink-0 space-y-2">
          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            title={isSidebarCollapsed && !isMobileMenuOpen ? 'Sair do Aplicativo' : undefined}
            className={`w-full flex items-center ${
              isSidebarCollapsed && !isMobileMenuOpen ? 'justify-center p-2.5' : 'justify-center gap-2 px-3 py-2.5'
            } rounded-xl bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/60 text-slate-400 hover:text-rose-300 text-xs font-bold transition-all active:scale-98`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Sair</span>}
          </button>

          {/* App Version Info */}
          {(!isSidebarCollapsed || isMobileMenuOpen) && (
            <div className="w-full flex items-center justify-between text-[10px] text-slate-400 px-1 py-0.5">
              <span className="font-semibold text-slate-500">GoField Pro</span>
              <span className="flex items-center gap-1.5 font-mono text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {APP_VERSION}
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
