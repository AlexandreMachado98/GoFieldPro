import React from 'react';
import { Home, Map, FileText, Flame, Gauge, HardDrive } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab, fireIncidents } = useApp();

  const activeFireCount = fireIncidents.filter((i) => i.status === 'em_combate').length;

  const navItems = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'map', label: 'GPS', icon: Map },
    { id: 'pdf_maps', label: 'Plantas PDF', icon: FileText },
    { id: 'fire_incidents', label: 'Incêndios', icon: Flame, badge: activeFireCount, isFlame: true },
    { id: 'field_rounds', label: 'Atividades', icon: Gauge },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[95000] bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around select-none">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === (item.id as any);

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative active:scale-95 ${
              isActive
                ? item.isFlame
                  ? 'text-rose-400 font-extrabold'
                  : 'text-sky-400 font-extrabold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <div className="relative">
              <Icon
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'scale-110' : ''
                } ${
                  item.isFlame && item.badge && item.badge > 0 ? 'text-rose-500 animate-pulse' : ''
                }`}
              />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-pulse border border-slate-950">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
