import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { LayerItem, BasemapType, PDFMapOverlay } from '../../types';
import { parseKMLString, parseKMZFile } from '../../utils/kmlParser';
import {
  X,
  Upload,
  Layers,
  FileText,
  Sliders,
  Eye,
  EyeOff,
  Trash2,
  Navigation,
  Globe,
  HardDrive,
  CheckCircle2,
  Sparkles,
  MapPin,
} from 'lucide-react';

export const LayerManagerModal: React.FC = () => {
  const {
    isLayerModalOpen,
    setIsLayerModalOpen,
    layers,
    toggleLayerVisibility,
    setLayerOpacity,
    addLayer,
    removeLayer,
    navigateToLayerFeature,
    basemap,
    setBasemap,
    t,
    currentRole,
    activeProject,
    notifyWarning,
    notifyError,
    notifySuccess,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'layers' | 'import_pdf' | 'import_kml' | 'basemap'>('layers');
  const [selectedLayerForFeatures, setSelectedLayerForFeatures] = useState<string | null>(null);

  // PDF/Image Form State
  const [pdfName, setPdfName] = useState('');
  const [pdfScale, setPdfScale] = useState('1:50.000');
  const [pdfDatum, setPdfDatum] = useState('SIRGAS 2000 (EPSG:4674)');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [topLeftLat, setTopLeftLat] = useState<string>(activeProject?.centerCoordinate ? (activeProject.centerCoordinate.lat + 0.05).toString() : '');
  const [topLeftLng, setTopLeftLng] = useState<string>(activeProject?.centerCoordinate ? (activeProject.centerCoordinate.lng - 0.05).toString() : '');
  const [bottomRightLat, setBottomRightLat] = useState<string>(activeProject?.centerCoordinate ? (activeProject.centerCoordinate.lat - 0.05).toString() : '');
  const [bottomRightLng, setBottomRightLng] = useState<string>(activeProject?.centerCoordinate ? (activeProject.centerCoordinate.lng + 0.05).toString() : '');

  // KML / KMZ Form State
  const [kmlFile, setKmlFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isLayerModalOpen) return null;

  const handlePdfUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfName || !pdfFile) {
      notifyWarning("Campos Obrigatórios", "Por favor, preencha o nome e selecione uma imagem do mapa.");
      return;
    }

    const tLat = parseFloat(topLeftLat);
    const tLng = parseFloat(topLeftLng);
    const bLat = parseFloat(bottomRightLat);
    const bLng = parseFloat(bottomRightLng);

    if (isNaN(tLat) || isNaN(tLng) || isNaN(bLat) || isNaN(bLng)) {
      notifyWarning("Coordenadas Inválidas", "Verifique os valores de latitude e longitude informados.");
      return;
    }

    const bounds: [[number, number], [number, number]] = [
      [bLat, tLng], // South West
      [tLat, bLng], // North East
    ];

    // Read image as base64
    const fileBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(pdfFile);
    });

    const newPdfOverlay: PDFMapOverlay = {
      id: `pdf-overlay-${Date.now()}`,
      name: pdfName,
      fileName: pdfFile.name,
      fileSize: `${(pdfFile.size / (1024 * 1024)).toFixed(1)} MB`,
      bounds,
      opacity: 0.7,
      visible: true,
      scale: pdfScale,
      datum: pdfDatum,
      pageCount: 1,
      currentPage: 1,
      georeferenced: true,
      url: fileBase64, // The actual image data
      previewUrl: fileBase64,
      uploadedAt: new Date().toISOString(),
    };

    const newLayer: LayerItem = {
      id: `layer-pdf-${Date.now()}`,
      name: pdfName,
      type: 'pdf',
      visible: true,
      opacity: 0.7,
      color: '#0284c7',
      category: 'topography',
      pdfData: newPdfOverlay,
      isOfflineCached: true,
      cacheSizeMB: +(pdfFile.size / (1024 * 1024)).toFixed(1),
    };

    addLayer(newLayer);
    setActiveSubTab('layers');
    setPdfName('');
    setPdfFile(null);
  };

  const handleKmlKmzUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const isKmz = file.name.toLowerCase().endsWith('.kmz');
      const layerId = `layer-${isKmz ? 'kmz' : 'kml'}-${Date.now()}`;

      if (isKmz) {
        const { features, name } = await parseKMZFile(file, layerId);
        const newLayer: LayerItem = {
          id: layerId,
          name: name || file.name,
          type: 'kmz',
          visible: true,
          opacity: 0.9,
          color: '#f97316',
          category: 'custom',
          itemCount: features.length,
          features,
          isOfflineCached: true,
          cacheSizeMB: +(file.size / (1024 * 1024)).toFixed(1),
        };
        addLayer(newLayer);
      } else {
        const text = await file.text();
        const features = parseKMLString(text, layerId);
        const newLayer: LayerItem = {
          id: layerId,
          name: file.name.replace(/\.kml$/i, ''),
          type: 'kml',
          visible: true,
          opacity: 0.9,
          color: '#10b981',
          category: 'custom',
          itemCount: features.length,
          features,
          isOfflineCached: true,
          cacheSizeMB: +(file.size / (1024 * 1024)).toFixed(1),
        };
        addLayer(newLayer);
      }
      setActiveSubTab('layers');
    } catch (err: any) {
      notifyError("Erro de Leitura", `Falha ao processar arquivo: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const activeLayerWithFeatures = layers.find((l) => l.id === selectedLayerForFeatures);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[min(90dvh,calc(100vh-32px))] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-400" />
            <h2 className="font-bold text-lg text-white">{t.tabLayers}</h2>
          </div>
          <button
            id="btn-close-layer-modal"
            onClick={() => setIsLayerModalOpen(false)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-3 sm:px-4 overflow-x-auto no-scrollbar shrink-0">
          <button
            id="tab-active-layers"
            onClick={() => { setActiveSubTab('layers'); setSelectedLayerForFeatures(null); }}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubTab === 'layers'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Camadas ({layers.length})</span>
          </button>

          {currentRole !== 'auditor' && (
            <>
              <button
                id="tab-import-pdf"
                className="hidden"
                data-old-class={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeSubTab === 'import_pdf'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                
              </button>

              <button
                id="tab-import-kml"
                onClick={() => setActiveSubTab('import_kml')}
                className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeSubTab === 'import_kml'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>{t.uploadKmlKmz}</span>
              </button>
            </>
          )}

          <button
            id="tab-select-basemap"
            onClick={() => setActiveSubTab('basemap')}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubTab === 'basemap'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>{t.basemap}</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-5 overflow-y-auto flex-1 text-sm text-slate-200 space-y-4">
          {/* Subtab: Active Layers List */}
          {activeSubTab === 'layers' && !selectedLayerForFeatures && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Camadas carregadas no projeto "{activeProject.name}"</span>
                <span>{layers.filter((l) => l.visible).length} visíveis</span>
              </div>

              {layers.map((layer) => (
                <div
                  key={layer.id}
                  className={`p-3 rounded-xl border transition-all ${
                    layer.visible
                      ? 'bg-slate-800/80 border-slate-700'
                      : 'bg-slate-900/40 border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Left Icon & Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleLayerVisibility(layer.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          layer.visible ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white truncate text-sm">{layer.name}</h4>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.2 rounded uppercase"
                            style={{
                              backgroundColor: `${layer.color}25`,
                              color: layer.color,
                              border: `1px solid ${layer.color}50`,
                            }}
                          >
                            {layer.type.toUpperCase()}
                          </span>
                          {layer.isOfflineCached && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                              <HardDrive className="w-3 h-3" /> {layer.cacheSizeMB} MB Offline
                            </span>
                          )}
                        </div>

                        {layer.pdfData && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            Escala: {layer.pdfData.scale} | Datum: {layer.pdfData.datum}
                          </div>
                        )}

                        {layer.features && layer.features.length > 0 && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            {layer.features.length} feições vetoriais (pontos, linhas e polígonos)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {layer.features && layer.features.length > 0 && (
                        <button
                          onClick={() => setSelectedLayerForFeatures(layer.id)}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-sky-950 border border-sky-800 text-sky-300 hover:bg-sky-900 transition-colors flex items-center gap-1"
                        >
                          <Navigation className="w-3 h-3" />
                          Navegar Feições
                        </button>
                      )}

                      {currentRole !== 'auditor' && (
                        <button
                          onClick={() => removeLayer(layer.id)}
                          className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Opacity Slider */}
                  {layer.visible && (
                    <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center gap-3 text-xs text-slate-400">
                      <Sliders className="w-3.5 h-3.5" />
                      <span>{t.pdfOpacity}:</span>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={layer.opacity}
                        onChange={(e) => setLayerOpacity(layer.id, parseFloat(e.target.value))}
                        className="flex-1 accent-sky-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                      />
                      <span className="font-mono w-10 text-right">{Math.round(layer.opacity * 100)}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Subtab: Point-by-Point Navigation inside Layer Features */}
          {selectedLayerForFeatures && activeLayerWithFeatures && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h4 className="font-bold text-white text-base">Feições de "{activeLayerWithFeatures.name}"</h4>
                  <p className="text-xs text-slate-400">Selecione qualquer ponto ou vértice da camada para iniciar a navegação com rumo e azimute.</p>
                </div>
                <button
                  onClick={() => setSelectedLayerForFeatures(null)}
                  className="text-xs text-sky-400 hover:underline"
                >
                  Voltar para lista
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {activeLayerWithFeatures.features?.map((feat) => (
                  <div
                    key={feat.id}
                    className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-200">
                          {feat.type}
                        </span>
                      </div>
                      <h5 className="font-bold text-sm text-slate-100">{feat.name}</h5>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">{feat.description || 'Elemento vetorial georreferenciado.'}</p>
                    </div>

                    <button
                      onClick={() => {
                        navigateToLayerFeature(feat);
                        setIsLayerModalOpen(false);
                      }}
                      className="mt-3 w-full py-1.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Navegar para este Ponto da Camada
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtab: Import PDF Map */}
          {activeSubTab === 'import_pdf' && (
            <form onSubmit={handlePdfUploadSubmit} className="space-y-4">
              <div className="p-4 rounded-xl bg-sky-950/30 border border-sky-800/40 text-xs text-sky-300 flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <b>Sobreposição de Imagem (Overlay):</b> Faça o upload de uma planta ou mapa convertido em imagem (JPG/PNG). Informe as coordenadas das extremidades para o aplicativo "esticar" a imagem no lugar exato do mundo.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nome do Mapa / Identificador *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Planta Baixa Loteamento 1A"
                  value={pdfName}
                  onChange={(e) => setPdfName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Canto Superior Esquerdo</label>
                  <div className="flex gap-2">
                    <input type="number" step="any" placeholder="Latitude" value={topLeftLat} onChange={e => setTopLeftLat(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-sky-500" />
                    <input type="number" step="any" placeholder="Longitude" value={topLeftLng} onChange={e => setTopLeftLng(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-sky-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Canto Inferior Direito</label>
                  <div className="flex gap-2">
                    <input type="number" step="any" placeholder="Latitude" value={bottomRightLat} onChange={e => setBottomRightLat(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-sky-500" />
                    <input type="number" step="any" placeholder="Longitude" value={bottomRightLng} onChange={e => setBottomRightLng(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-sky-500" />
                  </div>
                </div>
              </div>

              {/* Drag & Drop File Upload Area */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Imagem do Mapa (JPG, PNG)</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-xl p-6 text-center cursor-pointer bg-slate-800/40 hover:bg-slate-800/70 transition-all"
                >
                  <FileText className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-300">
                    {pdfFile ? pdfFile.name : 'Clique para selecionar imagem ou arraste aqui'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">Converta seu PDF para PNG ou JPG (Máx recomendado 5MB)</p>
                  <input
                    ref={fileInputRef}
                    type="file" onClick={(e) => e.stopPropagation()}
                    accept=".jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('layers')}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Importar e Georreferenciar Mapa PDF
                </button>
              </div>
            </form>
          )}

          {/* Subtab: Import KML / KMZ */}
          {activeSubTab === 'import_kml' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <b>Suporte a KML e Pacotes KMZ Compactados:</b> Importa trilhas, waypoints, perímetros, zonas de amortecimento e dados geográficos criados no Google Earth, QGIS, ArcGIS ou GPS Garmin.
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-8 text-center cursor-pointer bg-slate-800/40 hover:bg-slate-800/70 transition-all relative">
                <input
                  type="file" onClick={(e) => e.stopPropagation()}
                  accept=".kml,.kmz"
                  disabled={isProcessing}
                  onChange={handleKmlKmzUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Globe className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                <h4 className="font-bold text-sm text-slate-200">
                  {isProcessing ? 'Descompactando e Processando Arquivo...' : 'Clique ou arraste arquivo .KML ou .KMZ'}
                </h4>
                <p className="text-xs text-slate-500 mt-1">Compatível com camadas vetoriais e imagens sobrepostas</p>
              </div>
            </div>
          )}

          {/* Subtab: Select Basemap */}
          {activeSubTab === 'basemap' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  { id: 'satellite', name: 'Satélite Híbrido', desc: 'Imagens de alta resolução com ruas e locais (Google)', bg: 'bg-emerald-950 border-emerald-700' },
                  { id: 'topo', name: t.topo, desc: 'Curvas de nível e relevo sombreado', bg: 'bg-amber-950 border-amber-700' },
                  { id: 'osm', name: 'Mapa Viário (Ruas)', desc: 'Rede viária detalhada e pontos de referência', bg: 'bg-blue-950 border-blue-700' },
                  { id: 'dark', name: t.dark, desc: 'Operações táticas noturnas de baixo brilho', bg: 'bg-slate-950 border-slate-700' },
                ] as const
              ).map((b) => (
                <div
                  key={b.id}
                  onClick={() => setBasemap(b.id)}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    basemap === b.id
                      ? 'border-sky-500 bg-sky-950/40 shadow-xl'
                      : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                  }`}
                >
                  <h5 className="font-bold text-slate-100 text-sm">{b.name}</h5>
                  <p className="text-[11px] text-slate-400 mt-1">{b.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
