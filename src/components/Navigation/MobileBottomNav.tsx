import React from 'react';
import { Home, Map, FileText, Menu, Compass } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();

  const navItems = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'map', label: 'Mapa GPS', icon: Map },
    { id: 'pdf_maps', label: 'Plantas PDF', icon: FileText },
    { id: 'offline', label: 'Ferramentas', icon: Menu },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F17]/95 backdrop-blur-md border-t border-slate-800/80 px-4 pt-2 pb-[calc(0.6rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around select-none shadow-[0_-8px_20px_rgba(0,0,0,0.5)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          activeTab === item.id ||
          (item.id === 'offline' && ['offline', 'field_rounds', 'fire_incidents', 'admin', 'reports'].includes(activeTab));

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className="flex-1 flex flex-col items-center justify-center py-1 group relative transition-transform active:scale-95 cursor-pointer"
            aria-label={item.label}
          >
            {/* Android Material 3 Active Indicator Pill */}
            <div
              className={`px-5 py-1.5 rounded-full transition-all flex items-center justify-center ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'scale-105 stroke-[2.4]' : 'stroke-[1.8]'
                }`}
              />
            </div>
            <span
              className={`text-[11px] mt-1 tracking-tight font-medium transition-colors ${
                isActive ? 'font-black text-emerald-400' : 'text-slate-400'
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
