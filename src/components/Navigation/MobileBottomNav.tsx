import React from 'react';
import { Home, Map, Camera, Menu } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const MobileBottomNav: React.FC<{ onOpenMoreHub?: () => void }> = ({ onOpenMoreHub }) => {
  const { activeTab, setActiveTab } = useApp();

  const navItems = [
    { id: 'home', label: 'Trabalho', icon: Home },
    { id: 'map', label: 'Mapa', icon: Map },
    { id: 'evidence', label: 'Evidências', icon: Camera },
    { id: 'more', label: 'Mais', icon: Menu },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800/80 px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around select-none shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.4)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          activeTab === item.id ||
          (item.id === 'home' && activeTab === 'home') ||
          (item.id === 'more' && ['offline', 'pdf_maps', 'field_rounds', 'fire_incidents', 'admin', 'reports', 'more'].includes(activeTab));

        const handleClick = () => {
          if (item.id === 'more' && onOpenMoreHub) {
            onOpenMoreHub();
          } else {
            setActiveTab(item.id as any);
          }
        };

        return (
          <button
            key={item.id}
            onClick={handleClick}
            className="flex-1 flex flex-col items-center justify-center py-1 group relative transition-transform active:scale-95 cursor-pointer"
            aria-label={item.label}
          >
            {/* Active Pill in Royal Blue (Matching official mockup) */}
            <div
              className={`px-4 py-1 rounded-full transition-all flex items-center justify-center ${
                isActive
                  ? 'bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'scale-105 stroke-[2.4]' : 'stroke-[1.8]'
                }`}
              />
            </div>
            <span
              className={`text-[11px] mt-0.5 tracking-tight transition-colors ${
                isActive
                  ? 'font-extrabold text-blue-600 dark:text-blue-400'
                  : 'font-medium text-slate-500 dark:text-slate-400'
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
