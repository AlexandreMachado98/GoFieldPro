import React from 'react';
import { ClipboardCheck, Home, Map, Menu } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();

  const navItems = [
    { id: 'home', label: 'Missão', icon: Home },
    { id: 'map', label: 'Mapa', icon: Map },
    { id: 'field_rounds', label: 'Evidências', icon: ClipboardCheck },
    { id: 'offline', label: 'Mais', icon: Menu },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white/95 px-3 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_24px_rgba(13,27,42,0.08)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          activeTab === item.id ||
          (item.id === 'offline' && ['offline', 'pdf_maps', 'fire_incidents', 'admin', 'reports'].includes(activeTab));

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className="group relative flex flex-1 cursor-pointer flex-col items-center justify-center py-1 transition-transform active:scale-95"
            aria-label={item.label}
          >
            <span
              className={`flex items-center justify-center rounded-full px-4 py-1.5 transition-all ${
                isActive
                  ? 'border border-indigo-100 bg-indigo-50 text-[#3E4FEF] dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300'
                  : 'text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
              }`}
            >
              <Icon className={`h-5 w-5 transition-transform ${isActive ? 'scale-105 stroke-[2.2]' : 'stroke-[1.8]'}`} />
            </span>
            <span className={`mt-0.5 text-[10px] tracking-tight transition-colors ${isActive ? 'font-bold text-[#3E4FEF] dark:text-indigo-300' : 'font-medium text-slate-500 dark:text-slate-400'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
