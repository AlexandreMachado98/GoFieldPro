import React from 'react';
import { useApp } from '../../context/AppContext';
import { Navigation, Compass, ChevronRight, ChevronLeft, X, ArrowUpRight, Gauge, Clock, Flag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const NavigationHUD: React.FC = () => {
  const { navTarget, cancelNavigation, cycleNextPoint, cyclePrevPoint, currentGps, t } = useApp();

  if (!navTarget) return null;

  const distanceFormatted =
    navTarget.distanceMeters > 1000
      ? `${(navTarget.distanceMeters / 1000).toFixed(2)} km`
      : `${navTarget.distanceMeters} m`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className="absolute top-16 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4 pointer-events-none"
      >
        <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border-2 border-sky-500/80 rounded-2xl p-4 shadow-2xl text-slate-100">
          {/* Top Bar */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
              </span>
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5" />
                {t.navigationActive}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                id="btn-nav-prev"
                onClick={cyclePrevPoint}
                title={t.prevPoint}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                id="btn-nav-next"
                onClick={cycleNextPoint}
                title={t.nextPoint}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                id="btn-nav-cancel"
                onClick={cancelNavigation}
                title={t.cancelNav}
                className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95 ml-2"
              >
                <X className="w-3.5 h-3.5" />
                <span>Parar</span>
              </button>
            </div>
          </div>

          {/* Target Info & Compass Dial Grid */}
          <div className="grid grid-cols-12 gap-3 items-center">
            {/* Target Details */}
            <div className="col-span-8">
              <div className="text-[11px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                <Flag className="w-3 h-3 text-sky-400" />
                {t.target}:
              </div>
              <h3 className="font-bold text-base text-white truncate">{navTarget.name}</h3>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                LAT: {navTarget.lat.toFixed(5)}° | LNG: {navTarget.lng.toFixed(5)}°
              </div>

              {/* Metric Chips */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <div className="bg-sky-950/80 border border-sky-800/80 px-2.5 py-1 rounded-lg">
                  <div className="text-[9px] uppercase tracking-wider text-sky-400 font-semibold">{t.distance}</div>
                  <div className="text-base font-black font-mono text-sky-200">{distanceFormatted}</div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 px-2.5 py-1 rounded-lg">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">{t.eta}</div>
                  <div className="text-base font-bold font-mono text-slate-200 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    ~{navTarget.estimatedTimeArrivalMin} min
                  </div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 px-2.5 py-1 rounded-lg">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">{t.crossTrackError}</div>
                  <div className="text-base font-bold font-mono text-emerald-400">
                    ±{navTarget.crossTrackErrorMeters}m
                  </div>
                </div>
              </div>
            </div>

            {/* Tactical Azimuth Dial Visualizer */}
            <div className="col-span-4 flex flex-col items-center justify-center border-l border-slate-800 pl-3">
              <div className="relative w-20 h-20 rounded-full border-2 border-slate-700 bg-slate-950 flex items-center justify-center shadow-inner">
                {/* Compass Needle */}
                <div
                  className="absolute w-1 h-14 transition-transform duration-300 origin-center"
                  style={{ transform: `rotate(${navTarget.bearingDegrees}deg)` }}
                >
                  <div className="w-full h-1/2 bg-red-500 rounded-t-sm shadow-md"></div>
                  <div className="w-full h-1/2 bg-slate-600 rounded-b-sm"></div>
                </div>

                {/* Compass Center Pin */}
                <div className="w-3 h-3 rounded-full bg-white border-2 border-slate-900 z-10"></div>

                {/* N Cardinal Marker */}
                <span className="absolute top-1 text-[9px] font-bold text-red-400">N</span>
                <span className="absolute bottom-1 text-[9px] font-bold text-slate-500">S</span>
                <span className="absolute right-1.5 text-[9px] font-bold text-slate-500">E</span>
                <span className="absolute left-1.5 text-[9px] font-bold text-slate-500">W</span>
              </div>

              <div className="mt-1.5 text-center">
                <div className="text-[9px] text-slate-400 uppercase font-semibold">{t.bearing}</div>
                <div className="text-xs font-mono font-bold text-sky-400">{navTarget.azimuthString}</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
