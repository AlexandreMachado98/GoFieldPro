import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { PwaInstallButton } from './PWA/PwaInstallButton';
import {
  Map,
  Activity,
  Home,
  Users,
  HardDrive,
  UserCog,
  Gauge,
  FileText,
  Settings,
  LogOut,
  X
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    t,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    setIsSettingsModalOpen,
    showConfirm
  } = useApp();
  const { profile, logout } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (profile?.role !== 'super_admin') return;

    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      let count = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'pending') {
          count++;
        }
      });
      setPendingCount(count);
    }, (err) => {
      console.warn("Sidebar pending count listener:", err.message);
    });

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
  }

  const tabs: TabItem[] = [
    { id: 'home', label: t.tabHome || 'Início', icon: Home },
    { id: 'field_rounds', label: t.tabFieldRounds || 'Rodada de Campo', icon: Gauge },
    { id: 'pdf_maps', label: t.tabPdfMaps || 'Importar Mapa PDF', icon: FileText },
    { id: 'map', label: t.tabMap, icon: Map },
    { id: 'tracks', label: t.tabTracks, icon: Activity },
    { id: 'team', label: t.tabTeam, icon: Users },
    { id: 'offline', label: t.tabOffline, icon: HardDrive },
  ];

  if (profile?.role === 'super_admin') {
    tabs.push({ id: 'admin', label: 'Admin', icon: UserCog, badge: pendingCount });
  }

  return (
    <>
      {/* Mobile backdrop overlay - Stacking priority z-[99998] */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[99998] transition-opacity cursor-pointer" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 w-72 bg-slate-950 border-r border-slate-800 flex flex-col h-[100dvh] z-[99999] shadow-2xl transform transition-transform duration-300 ease-in-out select-none ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center text-white shadow-lg">
              <Map className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight leading-none">GoField <span className="text-sky-400">Pro</span></h1>
              <p className="text-[10px] text-slate-400 mt-0.5">Navegação GPS e mapas offline</p>
            </div>
          </div>
          <button 
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors active:scale-95"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Fechar Menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 pb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon as React.ElementType;
            const isActive = activeTab === (tab.id as any);
            const badgeCount = (tab as any).badge;

            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-extrabold transition-all active:scale-98 ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-950/50'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-sky-400'}`} />
                  <span>{tab.label}</span>
                </div>

                {badgeCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-500 text-slate-950 shadow-md animate-pulse">
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 border-t border-slate-900 space-y-1.5">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsSettingsModalOpen(true);
              }}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-900/80 transition-all active:scale-98"
            >
              <Settings className="w-5 h-5 text-sky-400" />
              <span>Configurações</span>
            </button>

            <PwaInstallButton variant="sidebar" />
          </div>
        </nav>

        {/* Sidebar Footer with prominent Logout Button */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950 shrink-0 space-y-2">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/60 text-rose-300 hover:text-rose-200 text-xs font-bold transition-all active:scale-98"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do Aplicativo</span>
          </button>
          <p className="text-[10px] text-slate-500 font-medium text-center">
            GoField Pro • Sistema de Campo
          </p>
        </div>
      </aside>
    </>
  );
};

