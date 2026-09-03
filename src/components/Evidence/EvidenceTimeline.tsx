import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ArrowLeft,
  Filter,
  MoreVertical,
  MapPin,
  Camera,
  FileText,
  CloudCheck,
  Cloud,
  CheckCircle2,
  Clock,
  ExternalLink,
  Navigation,
} from 'lucide-react';

interface EvidenceItem {
  id: string;
  type: 'waypoint' | 'photo' | 'form';
  title: string;
  description: string;
  timestamp: string;
  dateGroup: string;
  lat: number;
  lng: number;
  altitudeM: number;
  status: 'synchronized' | 'pending';
  thumbnailUrl?: string;
}

export const EvidenceTimeline: React.FC = () => {
  const { setActiveTab, waypoints, setNavTarget } = useApp();
  const [activeFilter, setActiveFilter] = useState<'all' | 'waypoint' | 'photo' | 'form'>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Evidence items combining active waypoints + realistic field audit records
  const evidenceItems: EvidenceItem[] = [
    {
      id: 'ev-1',
      type: 'waypoint',
      title: 'Waypoint 12',
      description: 'Cerca danificada',
      timestamp: '09:21',
      dateGroup: 'Hoje - 23 de maio de 2025',
      lat: -22.358742,
      lng: -47.892314,
      altitudeM: 642,
      status: 'synchronized',
      thumbnailUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&auto=format&fit=crop&q=80',
    },
    {
      id: 'ev-2',
      type: 'photo',
      title: 'Foto',
      description: 'Sinalização de segurança',
      timestamp: '09:05',
      dateGroup: 'Hoje - 23 de maio de 2025',
      lat: -22.359100,
      lng: -47.891020,
      altitudeM: 638,
      status: 'synchronized',
      thumbnailUrl: 'https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?w=400&auto=format&fit=crop&q=80',
    },
    {
      id: 'ev-3',
      type: 'form',
      title: 'Formulário',
      description: 'Checklist de EPI',
      timestamp: '08:47',
      dateGroup: 'Hoje - 23 de maio de 2025',
      lat: -22.359876,
      lng: -47.890112,
      altitudeM: 635,
      status: 'synchronized',
    },
    {
      id: 'ev-4',
      type: 'waypoint',
      title: 'Waypoint 11',
      description: 'Armazenamento inadequado',
      timestamp: '16:32',
      dateGroup: 'Ontem - 22 de maio de 2025',
      lat: -22.361200,
      lng: -47.889500,
      altitudeM: 620,
      status: 'synchronized',
      thumbnailUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&auto=format&fit=crop&q=80',
    },
  ];

  const filteredItems = evidenceItems.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.type === activeFilter;
  });

  // Group by date
  const groupedDates = Array.from(new Set(filteredItems.map((i) => i.dateGroup)));

  const handleNavigateToEvidence = (item: EvidenceItem) => {
    setNavTarget({
      name: item.title,
      lat: item.lat,
      lng: item.lng,
      altitude: item.altitudeM,
    });
    setActiveTab('map');
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-white dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 pb-28 select-none">
      {/* Top App Header */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md px-4 pt-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('home')}
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Linha do Tempo
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Filtrar"
          >
            <Filter className="w-5 h-5 stroke-[2]" />
          </button>
          <button
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Mais opções"
          >
            <MoreVertical className="w-5 h-5 stroke-[2]" />
          </button>
        </div>
      </header>

      {/* Filter Chips Bar */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 overflow-x-auto no-scrollbar flex items-center gap-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Todos
        </button>

        <button
          onClick={() => setActiveFilter('waypoint')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeFilter === 'waypoint'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Waypoints
        </button>

        <button
          onClick={() => setActiveFilter('photo')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeFilter === 'photo'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Fotos
        </button>

        <button
          onClick={() => setActiveFilter('form')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeFilter === 'form'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Formulários
        </button>
      </div>

      {/* Timeline Stream */}
      <div className="p-4 sm:p-6 max-w-lg mx-auto w-full space-y-6">
        {groupedDates.map((dateGroup) => {
          const itemsInGroup = filteredItems.filter((i) => i.dateGroup === dateGroup);

          return (
            <div key={dateGroup} className="space-y-4">
              {/* Date Group Heading */}
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-1">
                {dateGroup}
              </h3>

              {/* Vertical Connected Timeline */}
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
                {itemsInGroup.map((item) => {
                  return (
                    <div key={item.id} className="relative group">
                      {/* Node Indicator on Timeline */}
                      <div className="absolute -left-6 top-3 w-5 h-5 rounded-full bg-white dark:bg-[#0B1120] border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center z-10">
                        {item.type === 'waypoint' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        )}
                        {item.type === 'photo' && (
                          <Camera className="w-3 h-3 text-slate-500 stroke-[2.2]" />
                        )}
                        {item.type === 'form' && (
                          <FileText className="w-3 h-3 text-slate-500 stroke-[2.2]" />
                        )}
                      </div>

                      {/* Timeline Card */}
                      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Timestamp */}
                            <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 block mb-0.5">
                              {item.timestamp}
                            </span>

                            {/* Title & Description */}
                            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                              {item.title}
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                              {item.description}
                            </p>

                            {/* Geographic Coordinates & Altitude */}
                            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-1 truncate">
                              {item.lat.toFixed(6)}, {item.lng.toFixed(6)} • {item.altitudeM} m
                            </p>

                            {/* Sync Status Badge */}
                            <div className="flex items-center gap-2 mt-2">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3 stroke-[2.4]" />
                                <span>Sincronizado</span>
                              </span>

                              <button
                                onClick={() => handleNavigateToEvidence(item)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer ml-2"
                              >
                                <Navigation className="w-3 h-3" />
                                <span>Navegar</span>
                              </button>
                            </div>
                          </div>

                          {/* Right Photo Thumbnail (if present) */}
                          {item.thumbnailUrl && (
                            <div
                              onClick={() => setSelectedPhoto(item.thumbnailUrl || null)}
                              className="w-16 h-16 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer shadow-sm hover:scale-105 transition-transform"
                            >
                              <img
                                src={item.thumbnailUrl}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox / Modal for Photo Viewing */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150"
        >
          <img
            src={selectedPhoto}
            alt="Evidência em tela cheia"
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
