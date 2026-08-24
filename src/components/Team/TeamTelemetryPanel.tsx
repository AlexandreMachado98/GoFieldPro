import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Users,
  Radio,
  AlertOctagon,
  Battery,
  Signal,
  Send,
  ShieldAlert,
  MapPin,
  CheckCircle2,
  Bell,
  MessageSquare,
} from 'lucide-react';

export const TeamTelemetryPanel: React.FC = () => {
  const {
    teamMembers,
    sosActive,
    triggerSosBeacon,
    cancelSosBeacon,
    radioMessages,
    sendRadioMessage,
    t,
    currentRole,
  } = useApp();

  const [messageInput, setMessageInput] = useState('');

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    sendRadioMessage(messageInput);
    setMessageInput('');
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 max-w-5xl mx-auto text-slate-100 pb-32 sm:pb-16">
      {/* SOS Emergency Broadcast Banner */}
      <div className={`p-4 rounded-2xl border transition-all ${
        sosActive
          ? 'bg-red-950 border-red-600 shadow-2xl animate-pulse ring-4 ring-red-600/30'
          : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${sosActive ? 'bg-red-600 text-white' : 'bg-red-500/20 text-red-400'}`}>
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {sosActive ? t.sosActive : 'Canal de Resgate & Alerta de Emergência SOS'}
              </h3>
              <p className="text-xs text-slate-300">
                {sosActive
                  ? 'Transmissão contínua de telemetria GNSS e socorro ativada via rede satelital.'
                  : 'Emite alerta instantâneo com coordenadas e aciona a brigada de campo.'}
              </p>
            </div>
          </div>

          <div>
            {!sosActive ? (
              <button
                id="btn-trigger-sos-beacon"
                onClick={triggerSosBeacon}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black tracking-wider uppercase shadow-xl transition-all hover:scale-105 active:scale-95"
              >
                {t.sosAlert}
              </button>
            ) : (
              <button
                id="btn-cancel-sos-beacon"
                onClick={cancelSosBeacon}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
              >
                Cancelar Alerta de Emergência
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Team Telemetry & Radio Dispatch Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Remote Team Members List (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-400" />
              <h3 className="font-bold text-base text-white">{t.teamTitle}</h3>
            </div>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {teamMembers.length} operadores ativos
            </span>
          </div>

          <div className="space-y-2.5">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-slate-600"
                    />
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                        member.status === 'in_field'
                          ? 'bg-emerald-500'
                          : member.status === 'sos'
                          ? 'bg-red-500'
                          : 'bg-sky-500'
                      }`}
                    ></span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white">{member.name}</h4>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-700 text-slate-300 uppercase">
                        {member.role.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5">
                      {member.currentTask || 'Patrulhamento'}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      Lat: {member.lastLocation.lat.toFixed(4)} | Lng: {member.lastLocation.lng.toFixed(4)} | Alt: {member.lastLocation.altitude}m
                    </div>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="flex items-center justify-end gap-1.5 text-xs text-slate-300">
                    <Battery className={`w-4 h-4 ${member.batteryLevel < 25 ? 'text-red-400' : 'text-emerald-400'}`} />
                    <span className="font-mono">{member.batteryLevel}%</span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 text-xs text-slate-400">
                    <Signal className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-[10px] uppercase font-bold">{member.signalStrength}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">{member.lastUpdate}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tactical Radio Dispatch & Comms (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col h-[480px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-white">{t.radioDispatch}</h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">
              FREQUÊNCIA: 154.600 MHz / IP
            </span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
            {radioMessages.map((msg) => (
              <div key={msg.id} className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sky-400">{msg.sender}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{msg.time}</span>
                </div>
                <p className="text-slate-200 leading-relaxed">{msg.text}</p>
              </div>
            ))}
          </div>

          {/* Message Input Form */}
          <form onSubmit={handleSendMessage} className="pt-3 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              placeholder={t.sendMessage}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              className="p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Corporate Copyright Footer */}
      <footer className="mt-6 pt-4 pb-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-400">GoField Pro</span>
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
  );
};
