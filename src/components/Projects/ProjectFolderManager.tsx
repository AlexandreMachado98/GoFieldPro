import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ProjectFolder, UserRole } from '../../types';
import {
  Folder,
  FolderPlus,
  Lock,
  Unlock,
  Shield,
  Users,
  MapPin,
  FileSpreadsheet,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Plus,
} from 'lucide-react';

export const ProjectFolderManager: React.FC = () => {
  const {
    projects,
    activeProject,
    setActiveProject,
    createProject,
    currentRole,
    t,
  } = useApp();

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [lat, setLat] = useState(-20.2541);
  const [lng, setLng] = useState(-46.5823);
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    createProject({
      name,
      description,
      locationName: locationName || 'Brasil',
      centerCoordinate: { lat: Number(lat), lng: Number(lng), altitude: 1000 },
      zoomLevel: 13,
      tags: ['Operação de Campo', 'SIG'],
      encryptionEnabled,
      permissions: {
        super_admin: true,
        field_lead: true,
        surveyor: true,
        auditor: true,
      },
    });

    setIsCreatingProject(false);
    setName('');
    setDescription('');
    setLocationName('');
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 max-w-5xl mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div>
          <h2 className="font-bold text-lg text-white flex items-center gap-2">
            <Folder className="w-5 h-5 text-sky-400" />
            {t.projectsHeader}
          </h2>
          <p className="text-xs text-slate-400">Controle de acesso hierárquico por perfis e integridade criptográfica de dados corporativos.</p>
        </div>

        {currentRole === 'super_admin' && (
          <button
            id="btn-open-create-project"
            onClick={() => setIsCreatingProject(true)}
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg transition-colors shrink-0"
          >
            <FolderPlus className="w-4 h-4" />
            {t.createProject}
          </button>
        )}
      </div>

      {/* New Project Creation Form Modal / Card */}
      {isCreatingProject && (
        <form onSubmit={handleCreateSubmit} className="bg-slate-900 border-2 border-sky-500/60 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-sky-400" />
              {t.createProject}
            </h3>
            <button
              type="button"
              onClick={() => setIsCreatingProject(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">{t.projectName} *</label>
              <input
                type="text"
                required
                placeholder="Ex: Fazenda Santa Maria - Cadastro Ambiental Rural"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">{t.location} *</label>
              <input
                type="text"
                required
                placeholder="Ex: Uberlândia / MG"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">{t.projectDesc}</label>
            <textarea
              rows={2}
              placeholder="Descreva o escopo operacional da missão de campo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Latitude Central</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(parseFloat(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Longitude Central</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(parseFloat(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="crypto-check"
              checked={encryptionEnabled}
              onChange={(e) => setEncryptionEnabled(e.target.checked)}
              className="rounded accent-sky-500"
            />
            <label htmlFor="crypto-check" className="text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Ativar Criptografia de Ponta a Ponta (AES-256) nos dados desta pasta
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreatingProject(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg"
            >
              Criar Pasta de Projeto
            </button>
          </div>
        </form>
      )}

      {/* Projects List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((proj) => {
          const isActive = proj.id === activeProject.id;
          return (
            <div
              key={proj.id}
              onClick={() => setActiveProject(proj)}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                isActive
                  ? 'bg-slate-800/95 border-sky-500 shadow-2xl ring-2 ring-sky-500/20'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${isActive ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {isActive ? 'PROJETO ATIVO' : 'PASTA CORPORATIVA'}
                  </span>
                  {proj.encryptionEnabled && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                      <Lock className="w-3 h-3" /> E2EE
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-base text-white leading-snug">{proj.name}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{proj.description}</p>
                <div className="text-xs text-sky-400 mt-2 font-mono flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {proj.locationName}
                </div>
              </div>

              {/* Stats and Permissions */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-300">
                  <div className="bg-slate-950/60 p-1.5 rounded">
                    <span className="text-[9px] text-slate-400 block">Pontos</span>
                    <b>{proj.stats.waypointsCount}</b>
                  </div>
                  <div className="bg-slate-950/60 p-1.5 rounded">
                    <span className="text-[9px] text-slate-400 block">Trilhas</span>
                    <b>{proj.stats.tracksCount}</b>
                  </div>
                  <div className="bg-slate-950/60 p-1.5 rounded">
                    <span className="text-[9px] text-slate-400 block">Área (ha)</span>
                    <b>{proj.stats.areaCoveredHectares}</b>
                  </div>
                </div>

                {/* RBAC Permissions Badges */}
                <div className="text-[10px] text-slate-400 pt-1">
                  <span className="font-semibold block mb-1">Permissões de Acesso:</span>
                  <div className="flex flex-wrap gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">Admin</span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">Líder</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">Coletor</span>
                    {proj.permissions.auditor && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Auditor</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
