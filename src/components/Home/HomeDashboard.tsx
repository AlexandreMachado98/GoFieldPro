import React, { useState, useRef } from 'react';
import { formatFieldDistance } from '../../utils/geoUtils';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { FieldRound } from '../../types';
import { APP_VERSION } from '../../config/version';
import { generateFieldRoundsPdf } from '../../utils/fieldRoundsPdfReport';
import { PwaInstallButton } from '../PWA/PwaInstallButton';
import { 
  Gauge, 
  Map as MapIcon, 
  UploadCloud, 
  Clock, 
  Calendar, 
  MapPin, 
  Car, 
  User, 
  Camera, 
  Plus, 
  FileDown, 
  FileText,
  CheckCircle2, 
  ChevronRight, 
  ArrowRight,
  Image as ImageIcon,
  Check,
  Edit2,
  Trash2,
  X,
  Trees,
} from 'lucide-react';

export const HomeDashboard: React.FC = () => {
  const { 
    setActiveTab, 
    fieldRounds, 
    addFieldRound, 
    updateFieldRound, 
    deleteFieldRound, 
    addPhotoToFieldRound, 
    setIsWoodpileModalOpen,
    hasGpsLock,
    showConfirm,
    notifySuccess,
    notifyWarning,
    notifyError 
  } = useApp();

  const { profile, user } = useAuth();

  // Modal / Form state for Quick Creation from Dashboard
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);

  // Quick Finish State
  const [finishingRound, setFinishingRound] = useState<FieldRound | null>(null);
  const [quickFinalKm, setQuickFinalKm] = useState<string>('');
  const [quickEndTime, setQuickEndTime] = useState<string>('');

  // Lightbox for photos
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  // Quick Photo upload for specific round
  const directPhotoInputRef = useRef<HTMLInputElement>(null);
  const [targetRoundIdForPhoto, setTargetRoundIdForPhoto] = useState<string | null>(null);

  // Form Data
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    startTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    endTime: '',
    locationName: '',
    initialKm: '',
    finalKm: '',
    technicianName: profile?.displayName || user?.displayName || 'Técnico de Campo',
    vehiclePlate: '',
    purpose: '',
    notes: '',
    status: 'finalizada' as 'em_andamento' | 'finalizada',
    photos: [] as string[],
  });

  const photoInputRef = useRef<HTMLInputElement>(null);

  // KPI Calculations
  const totalKmSum = fieldRounds.reduce((sum, r) => sum + (r.totalKm || 0), 0);
  const activeRounds = fieldRounds.filter((r) => r.status === 'em_andamento');
  const completedRounds = fieldRounds.filter((r) => r.status === 'finalizada');
  const avgKm = fieldRounds.length > 0 ? (totalKmSum / fieldRounds.length).toFixed(1) : '0';

  // Compress image
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('Canvas context error');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files) as File[];
    try {
      const compressed: string[] = [];
      for (const file of files) {
        const base64 = await compressImage(file);
        compressed.push(base64);
      }
      setFormData((prev) => ({
        ...prev,
        photos: [...prev.photos, ...compressed],
      }));
      notifySuccess('Foto Carregada', `${compressed.length} foto(s) anexada(s).`);
    } catch (err) {
      console.error(err);
      notifyError('Erro na Imagem', 'Falha ao processar foto.');
    }
  };

  const handleDirectPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !targetRoundIdForPhoto) return;
    const file = e.target.files[0];
    try {
      const base64 = await compressImage(file);
      addPhotoToFieldRound(targetRoundIdForPhoto, base64);
    } catch (err) {
      console.error(err);
      notifyError('Erro na Imagem', 'Falha ao anexar imagem.');
    } finally {
      setTargetRoundIdForPhoto(null);
      if (directPhotoInputRef.current) directPhotoInputRef.current.value = '';
    }
  };

  const handleOpenCreate = () => {
    setEditingRoundId(null);
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      startTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      endTime: '',
      locationName: '',
      initialKm: '',
      finalKm: '',
      technicianName: profile?.displayName || user?.displayName || 'Técnico de Campo',
      vehiclePlate: '',
      purpose: '',
      notes: '',
      status: 'finalizada',
      photos: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (round: FieldRound) => {
    setEditingRoundId(round.id);
    setFormData({
      date: round.date,
      startTime: round.startTime,
      endTime: round.endTime || '',
      locationName: round.locationName,
      initialKm: round.initialKm.toString(),
      finalKm: round.finalKm ? round.finalKm.toString() : '',
      technicianName: round.technicianName,
      vehiclePlate: round.vehiclePlate || '',
      purpose: round.purpose || '',
      notes: round.notes || '',
      status: round.status,
      photos: round.photos || [],
    });
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.locationName.trim()) {
      notifyWarning('Campo Obrigatório', 'Informe o nome do local ou cliente visitado.');
      return;
    }
    const initKm = parseFloat(formData.initialKm);
    if (isNaN(initKm) || initKm < 0) {
      notifyWarning('KM Inválido', 'Informe um KM Inicial válido.');
      return;
    }
    let finKm = parseFloat(formData.finalKm);
    if (isNaN(finKm)) finKm = 0;

    if (formData.status === 'finalizada' && finKm > 0 && finKm < initKm) {
      notifyWarning('Atenção ao KM', 'O KM Final não pode ser menor que o KM Inicial.');
      return;
    }

    if (editingRoundId) {
      updateFieldRound(editingRoundId, {
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        locationName: formData.locationName,
        initialKm: initKm,
        finalKm: finKm,
        technicianName: formData.technicianName,
        vehiclePlate: formData.vehiclePlate,
        purpose: formData.purpose,
        notes: formData.notes,
        status: formData.status,
        photos: formData.photos,
      });
    } else {
      addFieldRound({
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        locationName: formData.locationName,
        initialKm: initKm,
        finalKm: finKm,
        technicianName: formData.technicianName,
        vehiclePlate: formData.vehiclePlate,
        purpose: formData.purpose,
        notes: formData.notes,
        status: formData.status,
        photos: formData.photos,
      });
    }
    setIsModalOpen(false);
  };

  const handleQuickFinishSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!finishingRound) return;
    const finKm = parseFloat(quickFinalKm);
    if (isNaN(finKm) || finKm <= finishingRound.initialKm) {
      notifyWarning('KM Inválido', `O KM Final deve ser maior que o KM Inicial (${finishingRound.initialKm} KM).`);
      return;
    }

    updateFieldRound(finishingRound.id, {
      finalKm: finKm,
      endTime: quickEndTime || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      status: 'finalizada',
    });
    setFinishingRound(null);
  };

  const handleDeleteRound = (round: FieldRound) => {
    showConfirm({
      title: 'Excluir Registro de Rodada',
      message: `Deseja remover a rodada de "${round.locationName}" (${round.totalKm} KM)?`,
      type: 'danger',
      confirmText: 'Excluir',
      onConfirm: () => {
        deleteFieldRound(round.id);
      },
    });
  };

  const handleExportPdf = async () => {
    if (fieldRounds.length === 0) {
      notifyWarning('Sem Dados', 'Não há registros de rodadas para emitir o relatório em PDF.');
      return;
    }
    try {
      await generateFieldRoundsPdf(fieldRounds);
      notifySuccess('Relatório Gerado', 'O PDF com todas as rodadas de campo foi gerado.');
    } catch (err: any) {
      notifyError('Erro ao Gerar PDF', err.message || 'Falha ao exportar PDF.');
    }
  };

  const calcModalTotalKm = () => {
    const init = parseFloat(formData.initialKm);
    const fin = parseFloat(formData.finalKm);
    if (!isNaN(init) && !isNaN(fin) && fin >= init) {
      return fin - init;
    }
    return 0;
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-y-auto bg-slate-950 pb-32 sm:pb-16 text-slate-100">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        
        {/* Hero Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                <Gauge className="w-3 h-3" />
                Painel do Técnico em Campo
              </span>
              {hasGpsLock && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  GPS Fixado
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              GoField <span className="text-sky-400">Pro</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Navegação GPS, mapas de campo em PDF e registro de rotas e pontos de vistoria.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 w-full sm:w-auto pt-1 sm:pt-0">
            <button
              onClick={() => setIsWoodpileModalOpen(true)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] sm:text-xs shadow transition-all active:scale-95 cursor-pointer truncate"
            >
              <Trees className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
              <span className="truncate">Cubagem (m³)</span>
            </button>

            <button
              onClick={() => setActiveTab('pdf_maps')}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-white font-bold text-[11px] sm:text-xs shadow transition-all active:scale-95 cursor-pointer truncate"
            >
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
              <span className="truncate">Plantas PDF</span>
            </button>

            <button
              onClick={handleExportPdf}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-white font-bold text-[11px] sm:text-xs shadow transition-all active:scale-95 cursor-pointer truncate"
            >
              <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 shrink-0" />
              <span className="truncate">Relatório PDF</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white font-bold text-[11px] sm:text-xs shadow-lg shadow-sky-950/50 transition-all active:scale-95 cursor-pointer truncate"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Nova Atividade</span>
            </button>
          </div>
        </div>

        {/* PWA Install Banner */}
        <PwaInstallButton variant="banner" />

        {/* Real-time Field Telemetry Summary Bar (Rodada de Campo) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-extrabold text-white">
                {totalKmSum.toLocaleString('pt-BR')} <span className="text-xs font-semibold text-sky-400">km</span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Total Rodado</div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-extrabold text-white">
                {completedRounds.length}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Viagens Finalizadas</div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-extrabold text-white">
                {activeRounds.length}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Em Andamento</div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-extrabold text-white">
                {avgKm} <span className="text-xs font-semibold text-purple-400">km</span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Média / Viagem</div>
            </div>
          </div>
        </div>

        {/* Section: Registros de Atividades de Campo */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-sky-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                Registros de Atividades de Campo
              </h2>
              <span className="text-xs text-slate-400 font-normal">
                ({fieldRounds.length} {fieldRounds.length === 1 ? 'registro' : 'registros'})
              </span>
            </div>
            <button
              onClick={() => setActiveTab('field_rounds')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              Ver todas as atividades
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {fieldRounds.length === 0 ? (
            <div 
              onClick={handleOpenCreate}
              className="border-2 border-dashed border-slate-800 hover:border-sky-500/50 bg-slate-900/40 hover:bg-slate-900 rounded-3xl p-8 text-center cursor-pointer transition-all group"
            >
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Gauge className="w-8 h-8" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white">Nenhuma atividade registrada</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                Toque aqui para registrar a primeira atividade ou deslocamento informando o KM Inicial, o local visitado e anexando fotos.
              </p>
              <button className="mt-4 px-4 py-2 rounded-xl bg-sky-600 text-white font-bold text-xs shadow transition-colors">
                Registrar Atividade Agora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {fieldRounds.map((round) => {
                const isFinished = round.status === 'finalizada';
                const formattedDate = round.date
                  ? new Date(round.date + 'T00:00:00').toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : 'Data não informada';

                return (
                  <div
                    key={round.id}
                    className={`bg-slate-900/90 border rounded-2xl p-5 transition-all shadow-md ${
                      isFinished
                        ? 'border-slate-800 hover:border-slate-700'
                        : 'border-amber-500/40 bg-amber-950/10 hover:border-amber-500/70'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Info */}
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                              isFinished
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                            }`}
                          >
                            {isFinished ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                Finalizada
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3" />
                                Em Andamento
                              </>
                            )}
                          </span>

                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {formattedDate}
                          </span>

                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            {round.startTime} {round.endTime ? `às ${round.endTime}` : ''}
                          </span>
                        </div>

                        {/* Location Name */}
                        <div className="flex items-start gap-2">
                          <MapPin className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                          <div>
                            <h3 className="text-base sm:text-lg font-bold text-white">
                              {round.locationName}
                            </h3>
                            {round.purpose && (
                              <p className="text-xs text-slate-300 mt-0.5">{round.purpose}</p>
                            )}
                          </div>
                        </div>

                        {/* Technician & Vehicle */}
                        <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            {round.technicianName}
                          </span>
                          {round.vehiclePlate && (
                            <span className="flex items-center gap-1.5 font-mono px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 text-[11px]">
                              <Car className="w-3.5 h-3.5 text-sky-400" />
                              {round.vehiclePlate}
                            </span>
                          )}
                          {round.notes && (
                            <span className="text-slate-400 italic text-[11px]">
                              Obs: {round.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Mileage and Action Box */}
                      <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800/80">
                        {/* Mileage numbers */}
                        <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5">
                          <div className="text-right">
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">
                              KM Inicial: <span className="text-white font-mono">{round.initialKm.toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">
                              KM Final:{' '}
                              <span className="text-white font-mono">
                                {round.finalKm ? round.finalKm.toLocaleString('pt-BR') : '--'}
                              </span>
                            </div>
                          </div>

                          <div className="h-7 w-[1px] bg-slate-800" />

                          <div className="text-center">
                            <div className="text-xs text-slate-400 font-bold uppercase">Total</div>
                            <div className="text-base sm:text-lg font-black text-sky-400 font-mono">
                              {round.totalKm > 0 ? formatFieldDistance(round.totalKm).full : '---'}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {!isFinished && (
                            <button
                              onClick={() => {
                                setFinishingRound(round);
                                setQuickFinalKm('');
                                setQuickEndTime(
                                  new Date().toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                );
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-all active:scale-95 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Finalizar Viagem
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setTargetRoundIdForPhoto(round.id);
                              directPhotoInputRef.current?.click();
                            }}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Tirar/Anexar foto"
                          >
                            <Camera className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(round)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Editar rodada"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteRound(round)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-red-900/60 text-slate-300 hover:text-red-400 transition-colors cursor-pointer"
                            title="Excluir rodada"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Photos Preview */}
                    {round.photos && round.photos.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-800/80">
                        <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                          Fotos do Odômetro e Local ({round.photos.length}):
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {round.photos.map((photo, pIdx) => (
                            <img
                              key={pIdx}
                              src={photo}
                              alt={`Evidência ${pIdx + 1}`}
                              onClick={() => setSelectedPhotoUrl(photo)}
                              className="w-16 h-16 object-cover rounded-xl border border-slate-700 hover:border-sky-400 cursor-pointer transition-all hover:scale-105 shrink-0"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fast Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Main Map Navigation Card */}
          <div 
            onClick={() => setActiveTab('map')}
            className="bg-slate-900/60 border border-slate-800 hover:border-sky-500/50 rounded-2xl p-5 cursor-pointer transition-all hover:bg-slate-900 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
                <MapIcon className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-sky-400 flex items-center gap-1">
                Acessar Mapa
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Mapa Satélite & Navegação</h3>
              <p className="text-xs text-slate-400 mt-1">
                Acesse o mapa cartográfico de campo com camadas KML, imagens aéreas e orientação por GPS.
              </p>
            </div>
          </div>

          {/* Full Field Rounds Panel Access */}
          <div 
            onClick={() => setActiveTab('field_rounds')}
            className="bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 cursor-pointer transition-all hover:bg-slate-900 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Gauge className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                Painel Completo
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Gestão Completa de Rodadas</h3>
              <p className="text-xs text-slate-400 mt-1">
                Consulte o histórico detalhado de viagens, filtre por período ou veículo e emita relatórios em PDF.
              </p>
            </div>
          </div>
        </div>

        {/* Corporate Copyright Footer with App Version */}
        <footer className="pt-6 pb-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">GoField Pro</span>
            <span className="font-mono text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-[10px]">
              {APP_VERSION}
            </span>
            <span>•</span>
            <span>AM TST SAÚDE E SEGURANÇA DO TRABALHO</span>
          </div>
          <a
            href="https://amtst.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:text-sky-300 font-medium hover:underline transition-colors"
          >
            https://amtst.vercel.app/
          </a>
        </footer>

      </div>

      {/* Hidden input for direct photo */}
      <input
        ref={directPhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleDirectPhotoUpload}
        className="hidden"
      />

      {/* Modal: New / Edit Field Round from Dashboard */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                  <Gauge className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    {editingRoundId ? 'Editar Atividade de Campo' : 'Registrar Atividade'}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Registro de deslocamento, local e observações
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, status: 'finalizada' }))}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    formData.status === 'finalizada'
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Viagem Concluída
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, status: 'em_andamento' }))}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    formData.status === 'em_andamento'
                      ? 'bg-amber-950/60 border-amber-500 text-amber-400'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Em Andamento
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Data *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Hora Inicial *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData((p) => ({ ...p, startTime: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Hora Final {formData.status === 'finalizada' ? '*' : ''}
                  </label>
                  <input
                    type="time"
                    required={formData.status === 'finalizada'}
                    value={formData.endTime}
                    onChange={(e) => setFormData((p) => ({ ...p, endTime: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Nome do Local / Cliente Visitado *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Fazenda Santa Maria - Gleba 02"
                  value={formData.locationName}
                  onChange={(e) => setFormData((p) => ({ ...p, locationName: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-sky-400 uppercase mb-1">
                    KM Inicial *
                  </label>
                  <input
                    type="number"
                    required
                    step="any"
                    placeholder="Ex: 45200"
                    value={formData.initialKm}
                    onChange={(e) => setFormData((p) => ({ ...p, initialKm: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-emerald-400 uppercase mb-1">
                    KM Final {formData.status === 'finalizada' ? '*' : ''}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required={formData.status === 'finalizada'}
                    placeholder="Ex: 45435"
                    value={formData.finalKm}
                    onChange={(e) => setFormData((p) => ({ ...p, finalKm: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">KM Total:</span>
                  <span className="text-base font-extrabold text-sky-400 font-mono">
                    {calcModalTotalKm() > 0 ? formatFieldDistance(calcModalTotalKm()).full : '--'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Técnico
                  </label>
                  <input
                    type="text"
                    value={formData.technicianName}
                    onChange={(e) => setFormData((p) => ({ ...p, technicianName: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Placa / Veículo
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: ABC-1234"
                    value={formData.vehiclePlate}
                    onChange={(e) => setFormData((p) => ({ ...p, vehiclePlate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Atividade / Observações
                </label>
                <input
                  type="text"
                  placeholder="Ex: Vistoria técnica de marcos e verificação de solo"
                  value={formData.purpose}
                  onChange={(e) => setFormData((p) => ({ ...p, purpose: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">
                    Fotos & Evidências ({formData.photos.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Adicionar Foto
                  </button>
                </div>

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {formData.photos.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto p-2 bg-slate-950 rounded-2xl border border-slate-800">
                    {formData.photos.map((p, idx) => (
                      <div key={idx} className="relative group shrink-0">
                        <img
                          src={p}
                          alt="preview"
                          className="w-16 h-16 object-cover rounded-xl border border-slate-700"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              photos: prev.photos.filter((_, i) => i !== idx),
                            }))
                          }
                          className="absolute -top-1 -right-1 p-1 bg-red-600 text-white rounded-full opacity-90 hover:opacity-100 shadow"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg shadow-sky-900/30 transition-all active:scale-95"
                >
                  Salvar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Finish Modal */}
      {finishingRound && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Finalizar Viagem</h3>
              </div>
              <button
                onClick={() => setFinishingRound(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400 font-medium">Local:</div>
              <div className="text-sm font-bold text-white">{finishingRound.locationName}</div>
              <div className="text-xs text-slate-400">
                KM Inicial registrado: <span className="text-sky-400 font-mono font-bold">{finishingRound.initialKm} KM</span>
              </div>
            </div>

            <form onSubmit={handleQuickFinishSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Hora de Chegada *
                </label>
                <input
                  type="time"
                  required
                  value={quickEndTime}
                  onChange={(e) => setQuickEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-400 uppercase mb-1">
                  KM Final (Odômetro de Chegada) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder={`Maior que ${finishingRound.initialKm}`}
                  value={quickFinalKm}
                  onChange={(e) => setQuickFinalKm(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                />
                {parseFloat(quickFinalKm) > finishingRound.initialKm && (
                  <p className="text-xs text-emerald-400 font-semibold mt-1">
                    Total: {parseFloat(quickFinalKm) - finishingRound.initialKm} KM rodados nesta viagem.
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFinishingRound(null)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-all"
                >
                  Confirmar e Concluir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Photo Preview */}
      {selectedPhotoUrl && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm cursor-pointer"
          onClick={() => setSelectedPhotoUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={selectedPhotoUrl}
              alt="Foto do odômetro/campo ampliada"
              className="max-w-full max-h-[85vh] rounded-2xl border border-slate-700 object-contain shadow-2xl"
            />
            <button
              onClick={() => setSelectedPhotoUrl(null)}
              className="absolute top-3 right-3 p-2 bg-black/70 hover:bg-black text-white rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
