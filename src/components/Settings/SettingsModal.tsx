import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useUpdate } from '../../context/UpdateContext';
import { APP_VERSION, APP_BUILD_DATE, APP_BUILD_NUMBER, APP_CHANGELOG } from '../../config/version';
import { AppSettings } from '../../types';
import {
  X,
  Settings,
  Compass,
  Navigation,
  MapPin,
  HardDrive,
  Trash2,
  Check,
  Shield,
  Smartphone,
  Eye,
  RefreshCw,
  Sliders,
  Sparkles,
  Zap,
  Globe,
  LogOut,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
  ArrowUpCircle,
  HelpCircle,
  Clock,
  Building2,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    updateSettings,
    notifySuccess,
    notifyInfo,
    notifyWarning,
    showConfirm
  } = useApp();
  const { profile, logout } = useAuth();
  const {
    isUpdateAvailable,
    latestVersion,
    isCheckingUpdate,
    isApplyingUpdate,
    checkForUpdates,
    applyUpdate,
    forceCleanUpdate,
    lastCheckedTime
  } = useUpdate();

  const [activeTab, setActiveTab] = useState<'gps' | 'coords' | 'maps' | 'field' | 'appearance' | 'system' | 'company'>('gps');
  const [cachedMapSize, setCachedMapSize] = useState<string>('Calculando...');
  const [isCleaning, setIsCleaning] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  // Custom Company Logo & Information for PDF Reports
  const [companyLogo, setCompanyLogo] = useState<string>(() => {
    return localStorage.getItem('gofield_custom_company_logo') || '';
  });
  const [companyName, setCompanyName] = useState<string>(() => {
    return localStorage.getItem('gofield_custom_company_name') || profile?.company || 'AM TST SAÚDE E SEGURANÇA DO TRABALHO';
  });
  const [companyCnpj, setCompanyCnpj] = useState<string>(() => {
    return localStorage.getItem('gofield_custom_company_cnpj') || '';
  });
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleManualCheckUpdates = async () => {
    const hasNew = await checkForUpdates(true);
    if (hasNew) {
      notifySuccess('Nova Versão Encontrada!', `A versão ${latestVersion} está pronta para ser instalada.`);
    } else {
      notifyInfo('Aplicativo Atualizado', `Você já está executando a versão mais recente (${APP_VERSION}).`);
    }
  };

  // Estimate local storage / IndexedDB cache size
  useEffect(() => {
    if (isOpen) {
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then((estimate) => {
          const usageMb = ((estimate.usage || 0) / (1024 * 1024)).toFixed(1);
          const quotaMb = ((estimate.quota || 0) / (1024 * 1024 * 1024)).toFixed(1);
          setCachedMapSize(`${usageMb} MB em uso (de ${quotaMb} GB disponíveis)`);
        }).catch(() => {
          setCachedMapSize('Armazenamento Local Ativo');
        });
      } else {
        setCachedMapSize('Armazenamento Offline Seguro (IndexedDB)');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClearCache = () => {
    showConfirm({
      title: 'Limpar Cache de Mapas e Arquivos?',
      message: 'Isso liberará espaço na memória do dispositivo. Seus pontos, trilhas e rodadas de campo NÃO serão apagados.',
      confirmText: 'Limpar Cache',
      cancelText: 'Cancelar',
      type: 'warning',
      onConfirm: async () => {
        setIsCleaning(true);
        try {
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
          notifySuccess('Cache Limpo com Sucesso', 'Memória liberada para operações de campo.');
          setCachedMapSize('0.0 MB em uso');
        } catch (e) {
          notifyWarning('Cache', 'Memória limpa no dispositivo.');
        } finally {
          setIsCleaning(false);
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full h-[90vh] max-h-[640px] shadow-2xl flex flex-col overflow-hidden text-slate-100 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Configurações do Aplicativo
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  GoField Pro
                </span>
              </h2>
              <p className="text-xs text-slate-400">Ajuste os parâmetros de GPS, coordenadas, precisão e mapas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-700 transition-colors"
            aria-label="Fechar Configurações"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 border-b border-slate-800/80 bg-slate-950/40 overflow-x-auto shrink-0 no-scrollbar">
          <button
            onClick={() => setActiveTab('gps')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'gps'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            GPS & Rastreamento
          </button>

          <button
            onClick={() => setActiveTab('coords')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'coords'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Coordenadas & Datum
          </button>

          <button
            onClick={() => setActiveTab('maps')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'maps'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Mapas & Memória
          </button>

          <button
            onClick={() => setActiveTab('field')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'field'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Marcações de Campo
          </button>

          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'appearance'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            Tema & Aparência
          </button>

          <button
            onClick={() => setActiveTab('company')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'company'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            Empresa & Laudos
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'system'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Rede & Desempenho
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* TAB 1: GPS & RASTREAMENTO */}
          {activeTab === 'gps' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Modo de Alta Precisão (GPS Nativo)
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Usa o hardware de GPS com satélites GNSS (GPS, GLONASS, Galileo) para máxima acurácia
                    </p>
                  </div>
                  <button
                    onClick={() => updateSettings({ gpsAccuracyMode: settings.gpsAccuracyMode === 'high' ? 'balanced' : 'high' })}
                    className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                      settings.gpsAccuracyMode === 'high' ? 'bg-sky-600' : 'bg-slate-800'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.gpsAccuracyMode === 'high' ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white">Intervalo de Amostragem do GPS</h4>
                <p className="text-[11px] text-slate-400">
                  Frequência em que a posição é atualizada na tela e nos mapas em PDF.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { ms: 1000, label: '1 segundo', desc: 'Tempo Real (Recomendado)' },
                    { ms: 3000, label: '3 segundos', desc: 'Balanceado' },
                    { ms: 5000, label: '5 segundos', desc: 'Economia de Bateria' },
                  ].map((item) => (
                    <button
                      key={item.ms}
                      onClick={() => updateSettings({ gpsUpdateIntervalMs: item.ms })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        settings.gpsUpdateIntervalMs === item.ms
                          ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{item.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white">Filtro de Deslocamento Mínimo para Gravação</h4>
                <p className="text-[11px] text-slate-400">
                  Distância mínima percorrida para adicionar um novo ponto à trilha (elimina ruídos de GPS parado).
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 5, 10].map((dist) => (
                    <button
                      key={dist}
                      onClick={() => updateSettings({ trackMinDistanceMeters: dist })}
                      className={`py-2 rounded-xl border text-center transition-all ${
                        settings.trackMinDistanceMeters === dist
                          ? 'bg-sky-600/20 border-sky-500 text-sky-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xs">{dist} metro{dist > 1 ? 's' : ''}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Centralização Automática (Auto-Pan)</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Mantém sua posição sempre visível no centro do mapa durante o deslocamento
                  </p>
                </div>
                <button
                  onClick={() => updateSettings({ autoCenterGps: !settings.autoCenterGps })}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                    settings.autoCenterGps ? 'bg-sky-600' : 'bg-slate-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.autoCenterGps ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-sky-400" />
                    Manter Tela Sempre Ativa (WakeLock)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Evita que o celular apague a tela durante a navegação em campo
                  </p>
                </div>
                <button
                  onClick={() => updateSettings({ keepScreenAwake: !settings.keepScreenAwake })}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                    settings.keepScreenAwake ? 'bg-sky-600' : 'bg-slate-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.keepScreenAwake ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: COORDENADAS & DATUM */}
          {activeTab === 'coords' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white">Formato Padrão de Exibição das Coordenadas</h4>
                <p className="text-[11px] text-slate-400">
                  Escolha como os pontos, waypoints e posição no PDF serão exibidos e exportados.
                </p>

                <div className="space-y-2">
                  {[
                    { id: 'DD', title: 'Graus Decimais (DD)', example: '-23.550520°, -46.633308°', desc: 'Padrão internacional para GPS e SIGs' },
                    { id: 'DMS', title: 'Graus, Minutos e Segundos (DMS)', example: '23°33\'01.87"S 46°37\'59.91"W', desc: 'Padrão topográfico e cartas impressas' },
                    { id: 'UTM', title: 'Projeção UTM (WGS84)', example: '23K 333390m E, 7394300m N', desc: 'Metros e fuso cartográfico' },
                    { id: 'SIRGAS', title: 'SIRGAS 2000 / Geodésico Brasil', example: 'SIRGAS 2000 (IBGE / INCRA)', desc: 'Padrão oficial brasileiro para georreferenciamento' },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => updateSettings({ coordinateFormat: fmt.id as any })}
                      className={`w-full p-3 rounded-xl border text-left flex items-start justify-between transition-all ${
                        settings.coordinateFormat === fmt.id
                          ? 'bg-sky-600/20 border-sky-500 text-white'
                          : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold flex items-center gap-2">
                          {fmt.title}
                          {settings.coordinateFormat === fmt.id && (
                            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-sky-400 mt-1">{fmt.example}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{fmt.desc}</div>
                      </div>
                      {settings.coordinateFormat === fmt.id && (
                        <Check className="w-4 h-4 text-sky-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white">Unidade de Medida (Distância e Altitude)</h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'metric', label: 'Métrico', desc: 'km, metros, km/h' },
                    { id: 'nautical', label: 'Náutico', desc: 'NM, pés, nós' },
                    { id: 'imperial', label: 'Imperial', desc: 'milhas, pés, mph' },
                  ].map((u) => (
                    <button
                      key={u.id}
                      onClick={() => updateSettings({ unitSystem: u.id as any })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        settings.unitSystem === u.id
                          ? 'bg-sky-600/20 border-sky-500 text-sky-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs">{u.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{u.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MAPAS & MEMÓRIA */}
          {activeTab === 'maps' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-sky-400" />
                      Armazenamento Local e Offline
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{cachedMapSize}</p>
                  </div>
                  <button
                    onClick={handleClearCache}
                    disabled={isCleaning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/80 text-rose-300 text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isCleaning ? 'Limpando...' : 'Limpar Cache'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Os mapas em PDF e plantas importadas são salvos no banco local do seu celular (IndexedDB) para garantir navegação fluida em campo sem sinal de internet.
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white">Qualidade de Renderização das Plantas em PDF</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'normal', title: 'Normal (Otimizada)', desc: 'Excelente fluidez e menor consumo de memória RAM' },
                    { id: 'high', title: 'Alta Definição (HD)', desc: 'Máxima nitidez em textos pequenos e curvas de nível' },
                  ].map((q) => (
                    <button
                      key={q.id}
                      onClick={() => updateSettings({ pdfRenderQuality: q.id as any })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        settings.pdfRenderQuality === q.id
                          ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{q.title}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{q.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MARCAÇÕES DE CAMPO */}
          {activeTab === 'field' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white">Cor Padrão dos Alfinetes de Localização</h4>
                <p className="text-[11px] text-slate-400">
                  Cor usada para novos waypoints e pontos de vistoria marcados no mapa.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  {[
                    { color: '#0284c7', name: 'Azul' },
                    { color: '#10b981', name: 'Verde' },
                    { color: '#f43f5e', name: 'Vermelho' },
                    { color: '#8b5cf6', name: 'Roxo' },
                    { color: '#f59e0b', name: 'Âmbar' },
                    { color: '#06b6d4', name: 'Ciano' },
                  ].map((c) => (
                    <button
                      key={c.color}
                      onClick={() => updateSettings({ defaultMarkerColor: c.color })}
                      title={c.name}
                      style={{ backgroundColor: c.color }}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95 shadow-lg ${
                        settings.defaultMarkerColor === c.color ? 'ring-3 ring-white ring-offset-2 ring-offset-slate-900 scale-105' : 'opacity-80'
                      }`}
                    >
                      {settings.defaultMarkerColor === c.color && (
                        <Check className="w-5 h-5 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white">Compressão de Fotos de Vistoria</h4>
                <p className="text-[11px] text-slate-400">
                  Equilíbrio entre fidelidade visual e economia de memória no celular.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'high', label: 'Alta', desc: '100% detalhada' },
                    { id: 'medium', label: 'Média (Ideal)', desc: 'Equilibrada' },
                    { id: 'low', label: 'Econômica', desc: 'Menor espaço' },
                  ].map((pq) => (
                    <button
                      key={pq.id}
                      onClick={() => updateSettings({ photoQuality: pq.id as any })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        settings.photoQuality === pq.id
                          ? 'bg-sky-600/20 border-sky-500 text-sky-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs">{pq.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{pq.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: TEMA & APARÊNCIA */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-400" />
                  Tema Visual da Interface
                </h4>
                <p className="text-[11px] text-slate-400">
                  Alterne entre o tema escuro tático ou o tema claro de alta visibilidade sob luz solar direta.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Modo Escuro */}
                  <button
                    onClick={() => updateSettings({ theme: 'dark' })}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      (settings.theme === 'dark' || !settings.theme)
                        ? 'bg-sky-600/20 border-sky-500 text-white ring-2 ring-sky-500/40 shadow-lg'
                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 text-indigo-400 flex items-center justify-center">
                        <Moon className="w-4 h-4" />
                      </div>
                      {(settings.theme === 'dark' || !settings.theme) && (
                        <Check className="w-4 h-4 text-sky-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Modo Escuro Tático</div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-snug">
                        Ideal para baixa luminosidade e economia de energia em telas AMOLED.
                      </div>
                    </div>
                  </button>

                  {/* Modo Claro */}
                  <button
                    onClick={() => updateSettings({ theme: 'light' })}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      settings.theme === 'light'
                        ? 'bg-sky-600/20 border-sky-500 text-white ring-2 ring-sky-500/40 shadow-lg'
                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                        <Sun className="w-4 h-4" />
                      </div>
                      {settings.theme === 'light' && (
                        <Check className="w-4 h-4 text-sky-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Modo Claro (Luz Solar)</div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-snug">
                        Fundo claro com alto contraste, perfeito para trabalho sob sol forte.
                      </div>
                    </div>
                  </button>

                  {/* Modo Automático */}
                  <button
                    onClick={() => updateSettings({ theme: 'auto' })}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      settings.theme === 'auto'
                        ? 'bg-sky-600/20 border-sky-500 text-white ring-2 ring-sky-500/40 shadow-lg'
                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center">
                        <Monitor className="w-4 h-4" />
                      </div>
                      {settings.theme === 'auto' && (
                        <Check className="w-4 h-4 text-sky-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Automático (Sistema)</div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-snug">
                        Acompanha as configurações de tema do seu celular/sistema operacional.
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: EMPRESA, LOGOTIPO & LAUDOS */}
          {activeTab === 'company' && (
            <div className="space-y-4 animate-in fade-in text-xs">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-400" />
                      Logotipo & Identidade Visual dos Laudos PDF
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Este logotipo e os dados da sua empresa serão impressos no cabeçalho oficial de todos os laudos técnicos em PDF.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1">
                      Logotipo da Empresa (PNG / JPG)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      ref={logoInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result as string;
                            setCompanyLogo(result);
                            localStorage.setItem('gofield_custom_company_logo', result);
                            notifySuccess('Logotipo Carregado!', 'A imagem será usada no cabeçalho dos laudos PDF.');
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />

                    <div className="flex items-center gap-3">
                      {companyLogo ? (
                        <div className="relative w-20 h-20 rounded-2xl bg-slate-900 border border-emerald-500/50 p-1 flex items-center justify-center overflow-hidden">
                          <img src={companyLogo} alt="Logo" className="max-w-full max-h-full object-contain" />
                          <button
                            type="button"
                            onClick={() => {
                              setCompanyLogo('');
                              localStorage.removeItem('gofield_custom_company_logo');
                              notifyWarning('Logotipo Removido', 'Os laudos usarão o brasão padrão do sistema.');
                            }}
                            className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white p-1 rounded-lg"
                            title="Remover logotipo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-slate-950 border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 text-[10px]">
                          <ImageIcon className="w-6 h-6 mb-1 text-slate-600" />
                          <span>Sem Logo</span>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 active:scale-95"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{companyLogo ? 'Trocar Logotipo' : 'Enviar Logotipo da Empresa'}</span>
                        </button>
                        <p className="text-[10px] text-slate-500">
                          Recomendado: Imagem PNG com fundo transparente ou JPG nítido.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1">
                        Nome da Empresa / Razão Social
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => {
                          setCompanyName(e.target.value);
                          localStorage.setItem('gofield_custom_company_name', e.target.value);
                        }}
                        placeholder="Ex: Madeireira & Silvicultura Vale Verde"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1">
                        CNPJ da Empresa
                      </label>
                      <input
                        type="text"
                        value={companyCnpj}
                        onChange={(e) => {
                          setCompanyCnpj(e.target.value);
                          localStorage.setItem('gofield_custom_company_cnpj', e.target.value);
                        }}
                        placeholder="00.000.000/0000-00"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: REDE, SISTEMA & ATUALIZAÇÕES */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Arquitetura de Execução Local (Zero Latência)
                </h4>
                <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                  <p>
                    • <b>Execução 100% no Dispositivo:</b> Toda a navegação GPS, posicionamento vetorial, cubagem de madeira e renderização de PDFs operam <b>diretamente no navegador/hardware do seu celular</b>.
                  </p>
                  <p>
                    • <b>Latência do GPS: 0 ms</b> (sem delay de rede para mapas e navegação local).
                  </p>
                  <p>
                    • <b>Banco de Dados na Nuvem:</b> Sincronização automática para manter seus relatórios e pontos protegidos.
                  </p>
                </div>
              </div>

              {/* Version & Live Auto-Update Center */}
              <div className="bg-slate-950/80 border border-sky-500/40 rounded-2xl p-4 space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-white flex items-center gap-2">
                        <span>Versão do Aplicativo</span>
                        <span className="font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-full text-[10px]">
                          {APP_VERSION}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Build #{APP_BUILD_NUMBER} • Lançamento: {APP_BUILD_DATE}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Operacional
                  </span>
                </div>

                {/* Update Available Banner (if detected) */}
                {isUpdateAvailable && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-sky-950/80 to-emerald-950/80 border border-sky-500/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 animate-in fade-in">
                    <div>
                      <div className="text-xs font-black text-white flex items-center gap-1.5">
                        <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
                        <span>Nova versão {latestVersion} pronta para instalação!</span>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        Clique abaixo para aplicar a atualização imediatamente sem perder dados locais.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={applyUpdate}
                      disabled={isApplyingUpdate}
                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isApplyingUpdate ? 'animate-spin' : ''}`} />
                      <span>Atualizar Agora</span>
                    </button>
                  </div>
                )}

                {/* Update Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleManualCheckUpdates}
                    disabled={isCheckingUpdate}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-sky-400 hover:text-sky-300 font-bold text-xs active:scale-95 transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin text-sky-400' : ''}`} />
                    <span>{isCheckingUpdate ? 'Verificando Servidor...' : 'Verificar Atualizações'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      showConfirm({
                        title: 'Forçar Atualização Limpa?',
                        message: 'Isso reiniciará os componentes de cache do aplicativo no celular para forçar o download dos arquivos mais recentes da versão. Seus pontos, mapas e vistorias permanecerão intactos.',
                        confirmText: 'Forçar Atualização',
                        cancelText: 'Cancelar',
                        type: 'info',
                        onConfirm: forceCleanUpdate,
                      });
                    }}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-amber-400 hover:text-amber-300 font-bold text-xs active:scale-95 transition-all"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Forçar Recarga Limpa</span>
                  </button>
                </div>

                {lastCheckedTime && (
                  <div className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Última verificação: {lastCheckedTime.toLocaleTimeString('pt-BR')}</span>
                  </div>
                )}
              </div>

              {/* Changelog / Novidades da Versão */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setShowChangelog(!showChangelog)}
                  className="w-full flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white"
                >
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-teal-400" />
                    Novidades & Registro de Versões (Changelog)
                  </span>
                  <span className="text-[10px] font-bold text-sky-400">
                    {showChangelog ? 'Ocultar' : 'Ver Detalhes'}
                  </span>
                </button>

                {showChangelog && (
                  <div className="space-y-3 pt-2 border-t border-slate-800/80 animate-in fade-in">
                    {APP_CHANGELOG.map((item) => (
                      <div key={item.version} className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-xs">
                            {item.version} - {item.title}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.date}</span>
                        </div>
                        <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
                          {item.highlights.map((h, i) => (
                            <li key={i} className="leading-snug text-slate-300">
                              {h}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Account Logout Box */}
              <div className="bg-rose-950/20 border border-rose-900/50 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <LogOut className="w-3.5 h-3.5" />
                    Encerrar Sessão
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Conectado como <b className="text-slate-300">{profile?.email || 'Usuário'}</b>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    onClose();
                    await logout();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-md shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair da Conta</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="text-[11px] text-slate-500">
            Alterações salvas automaticamente no dispositivo.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-sky-600/20"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
