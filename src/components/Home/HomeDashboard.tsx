import React from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowUpRight,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CloudOff,
  Compass,
  FileText,
  Gauge,
  HardDrive,
  Map as MapIcon,
  Navigation,
  Plus,
  Route,
  Trees,
  WifiOff,
} from 'lucide-react';
import { formatFieldDistance } from '../../utils/geoUtils';

const StatusTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: 'success' | 'indigo' | 'neutral';
}> = ({ icon, label, value, detail, tone = 'neutral' }) => {
  const toneClass = {
    success: 'field-status-success',
    indigo: 'field-status-offline',
    neutral: 'bg-slate-50 text-slate-700 border-slate-200',
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-[11px] font-bold opacity-80">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-xl font-black tracking-tight">{value}</div>
      <div className="mt-0.5 text-[11px] font-medium opacity-75">{detail}</div>
    </div>
  );
};

const QuickAction: React.FC<{
  icon: React.ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
  tone?: 'indigo' | 'green' | 'amber' | 'neutral';
}> = ({ icon, title, detail, onClick, tone = 'indigo' }) => {
  const iconTone = {
    indigo: 'bg-indigo-50 text-[#3E4FEF] border-indigo-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  }[tone];

  return (
    <button
      onClick={onClick}
      className="field-card group flex min-h-[112px] items-start gap-3 p-4 text-left transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${iconTone}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold text-slate-900">{title}</span>
        <span className="mt-1 block text-[11px] font-medium leading-4 text-slate-500">{detail}</span>
      </span>
      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-[#3E4FEF]" />
    </button>
  );
};

export const HomeDashboard: React.FC = () => {
  const {
    setActiveTab,
    fieldRounds,
    hasGpsLock,
    currentGps,
    isOffline,
    offlineQueue,
    isSyncing,
    openUpgradeModal,
    isProUser,
    activeProject,
  } = useApp();
  const { profile } = useAuth();

  const activeRounds = fieldRounds.filter((round) => round.status === 'em_andamento');
  const currentRound = activeRounds[0] || fieldRounds[0];
  const missionProgress = currentRound ? Math.min(100, Math.max(12, Math.round((currentRound.totalKm || 0) * 18))) : 0;
  const firstName = profile?.name?.split(' ')[0] || 'Técnico de campo';
  const gpsAccuracy = currentGps?.accuracy ? `${currentGps.accuracy.toFixed(0)} m` : '—';

  return (
    <div className="field-os-canvas flex-1 overflow-y-auto pb-28">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#3E4FEF]">Mesa de missão</p>
            <h1 className="text-2xl font-black tracking-tight text-[#0D1B2A] sm:text-3xl">Olá, {firstName}</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Tudo pronto para a próxima atividade em campo.</p>
          </div>
          <div className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm sm:flex">
            <Compass className="h-5 w-5" />
          </div>
        </header>

        <section className="field-card overflow-hidden p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#3E4FEF]">Projeto ativo</span>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${isOffline ? 'field-status-offline' : 'field-status-success'}`}>
                  {isOffline ? 'Offline' : 'Sincronizado'}
                </span>
              </div>
              <h2 className="truncate text-xl font-black tracking-tight text-[#0D1B2A]">{activeProject?.name || 'Levantamento de campo'}</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">{currentRound?.locationName || 'Escolha uma atividade para começar a coletar evidências.'}</p>
            </div>
            <button onClick={() => setActiveTab('map')} className="field-primary-button inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black">
              <MapIcon className="h-4 w-4" />
              Continuar no campo
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatusTile icon={<Navigation className="h-4 w-4" />} label="Precisão do GPS" value={hasGpsLock ? `±${gpsAccuracy}` : 'Buscando'} detail={hasGpsLock ? 'Sinal excelente' : 'Aguardando sinal'} tone={hasGpsLock ? 'success' : 'neutral'} />
            <StatusTile icon={isOffline ? <WifiOff className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} label="Conexão" value={isOffline ? 'Offline' : 'Online'} detail={isOffline ? 'Dados no dispositivo' : 'Sincronização ativa'} tone="indigo" />
            <StatusTile icon={<Route className="h-4 w-4" />} label="Atividades" value={`${fieldRounds.length}`} detail="Registros no projeto" tone="neutral" />
            <StatusTile icon={<CloudOff className="h-4 w-4" />} label="Pendências" value={`${offlineQueue.length}`} detail={isSyncing ? 'Sincronizando agora' : 'Aguardando envio'} tone={offlineQueue.length > 0 ? 'indigo' : 'success'} />
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-black text-slate-700">Progresso da missão</span><span className="text-xs font-black text-[#3E4FEF]">{missionProgress}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#3E4FEF] transition-all" style={{ width: `${missionProgress}%` }} /></div>
            <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-500"><span>{currentRound ? `${formatFieldDistance(currentRound.totalKm || 0).full} percorridos` : 'Nenhuma missão em andamento'}</span><span>{activeRounds.length ? 'Em andamento' : 'Pronto para iniciar'}</span></div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between px-1"><div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Acesso rápido</p><h2 className="mt-1 text-lg font-black tracking-tight text-[#0D1B2A]">Ferramentas de campo</h2></div><button onClick={() => setActiveTab('offline')} className="inline-flex items-center gap-1 text-xs font-black text-[#3E4FEF]">Ver todas <ChevronRight className="h-4 w-4" /></button></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <QuickAction icon={<MapIcon className="h-5 w-5" />} title="Mapa GPS" detail="Navegue e marque pontos" onClick={() => setActiveTab('map')} />
            <QuickAction icon={<FileText className="h-5 w-5" />} title="Plantas PDF" detail="Mapas calibrados offline" onClick={() => setActiveTab('pdf_maps')} tone="green" />
            <QuickAction icon={<ClipboardCheck className="h-5 w-5" />} title="Rondas" detail="Registre a atividade" onClick={() => setActiveTab('field_rounds')} tone="amber" />
            <QuickAction icon={<Trees className="h-5 w-5" />} title="Cubagem" detail="Calcule madeira em campo" onClick={() => setActiveTab('offline')} tone="neutral" />
          </div>
        </section>

        <section className="field-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Histórico operacional</p><h2 className="mt-1 text-lg font-black tracking-tight text-[#0D1B2A]">Linha do tempo recente</h2></div><button onClick={() => setActiveTab('field_rounds')} className="text-xs font-black text-[#3E4FEF]">Ver registros</button></div>
          {fieldRounds.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-7 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-[#3E4FEF]"><Plus className="h-5 w-5" /></div><p className="mt-3 text-sm font-bold text-slate-700">Nenhuma evidência registrada ainda</p><p className="mt-1 text-xs text-slate-500">Comece uma missão para criar a sua linha do tempo.</p><button onClick={() => setActiveTab('map')} className="mt-4 text-xs font-black text-[#3E4FEF]">Abrir mapa</button></div>
          ) : (
            <div className="divide-y divide-slate-100">{fieldRounds.slice(0, 4).map((round) => <button key={round.id} onClick={() => setActiveTab('field_rounds')} className="flex w-full items-center gap-3 py-3 text-left first:pt-0 last:pb-0"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${round.status === 'finalizada' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{round.status === 'finalizada' ? <CheckCircle2 className="h-4 w-4" /> : <Gauge className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-slate-800">{round.locationName}</span><span className="mt-0.5 block text-[11px] font-medium text-slate-500">{round.date} · {round.technicianName}</span></span><span className="text-right"><span className="block text-xs font-black text-[#3E4FEF]">{round.totalKm} km</span><span className="mt-0.5 block text-[10px] font-bold uppercase text-slate-400">{round.status}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-slate-300" /></button>)}</div>
          )}
        </section>

        {!isProUser && <section className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-[#0D1B2A] p-5 text-white shadow-lg sm:flex-row sm:items-center sm:p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-300"><Camera className="h-5 w-5" /></span><div><h3 className="text-sm font-black">Leve todas as evidências para o campo</h3><p className="mt-1 text-xs font-medium text-slate-300">Desbloqueie mapas PDF, fotos e registros ilimitados.</p></div></div><button onClick={() => openUpgradeModal('Mesa de Missão')} className="rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#0D1B2A] transition-transform active:scale-95">Conhecer o Pro</button></section>}

        <div className="flex items-center justify-center gap-2 pb-2 text-[10px] font-semibold text-slate-400"><HardDrive className="h-3.5 w-3.5" />Seus dados de campo permanecem protegidos no dispositivo e na nuvem.</div>
      </div>
    </div>
  );
};
