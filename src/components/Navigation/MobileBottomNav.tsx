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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[95000] bg-[#070d1e]/95 backdrop-blur-md border-t border-[#253352]/80 px-2 py-1.5 flex items-center justify-around select-none">
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
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative active:scale-95 ${
              isActive
                ? 'text-sky-400 font-extrabold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <div className="relative">
              <Icon
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'scale-110' : ''
                }`}
              />
              {isLocked && (
                <Lock className="w-2.5 h-2.5 text-amber-400 absolute -top-1 -right-1.5" />
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight flex items-center gap-0.5">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
