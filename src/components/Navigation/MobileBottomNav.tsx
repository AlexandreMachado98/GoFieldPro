import React from 'react';
import { Home, Map, FileText, Gauge, HardDrive, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab, isProUser, openUpgradeModal } = useApp();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin' || profile?.email === 'alexandre1604981@gmail.com';

  const navItems = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'map', label: 'GPS', icon: Map },
    { id: 'pdf_maps', label: 'Plantas PDF', icon: FileText },
    { id: 'field_rounds', label: 'Atividades', icon: Gauge, isPremium: true },
    { id: 'offline', label: 'Offline', icon: HardDrive },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070A10]/95 backdrop-blur-lg border-t border-slate-800/90 px-2 pt-2 pb-[calc(0.6rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around select-none shadow-[0_-10px_25px_rgba(0,0,0,0.6)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === (item.id as any);
        const isLocked = item.isPremium && !isProUser && !isSuperAdmin;

        return (
          <button
            key={item.id}
            onClick={() => {
              if (isLocked) {
                openUpgradeModal('Registrar Atividade de Campo');
                return;
              }
              setActiveTab(item.id as any);
            }}
            className="flex-1 flex flex-col items-center justify-center py-1 group relative transition-transform active:scale-90"
            aria-label={item.label}
          >
            {/* Material 3 Active Indicator Pill */}
            <div
              className={`px-4 py-1 rounded-full transition-all flex items-center justify-center relative ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                  : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'
                }`}
              />
              {isLocked && (
                <Lock className="w-2.5 h-2.5 text-amber-400 absolute -top-1 -right-1" />
              )}
            </div>
            <span
              className={`text-[10px] mt-1 tracking-tight transition-colors ${
                isActive ? 'font-black text-emerald-400' : 'font-semibold text-slate-400'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
