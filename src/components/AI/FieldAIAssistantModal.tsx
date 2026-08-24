import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Sparkles,
  Send,
  Compass,
  MapPin,
  FileText,
  ShieldCheck,
  Bot,
  User,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

export const FieldAIAssistantModal: React.FC = () => {
  const {
    isAiModalOpen,
    setIsAiModalOpen,
    activeProject,
    waypoints,
    currentGps,
    t,
  } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'ai',
      text: `Olá! Sou o Assistente de Inteligência Geoespacial do GeoField Pro. Posso auxiliar na conversão de coordenadas cartográficas (SIRGAS 2000 / UTM), análise de declividade e relevo, verificação de conformidade em APPs (Áreas de Preservação Permanente) e redação automática do parecer técnico do projeto "${activeProject.name}". Como posso ajudar na operação hoje?`,
      timestamp: 'Agora',
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  if (!isAiModalOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim()) return;

    const userText = inputPrompt;
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsTyping(true);

    // Simulate specialized geospatial reasoning response
    setTimeout(() => {
      let reply = '';
      const lower = userText.toLowerCase();

      if (lower.includes('relatório') || lower.includes('parecer') || lower.includes('dossiê')) {
        reply = `📄 **Minuta de Parecer Técnico Gerada para "${activeProject.name}":**\n\n- **Área Geográfica:** ${activeProject.locationName} (Centro: ${activeProject.centerCoordinate.lat.toFixed(5)}, ${activeProject.centerCoordinate.lng.toFixed(5)})\n- **Pontos Inspecionados:** ${waypoints.length} marcos validados com precisão submétrica (±${currentGps.accuracy}m).\n- **Diagnóstico Ambiental:** Recursos hídricos preservados, com necessidade de reforço na sinalização do setor de trilha baixa.\n- **Conclusão:** Atividades de campo em plena conformidade com as diretrizes do plano de manejo e normas do ICMBio/IBAMA.`;
      } else if (lower.includes('utm') || lower.includes('coordenada') || lower.includes('datum') || lower.includes('sirgas')) {
        reply = `🌐 **Análise Geodésica e Transformação de Coordenadas:**\n\n- **Datum Oficial:** SIRGAS 2000 (EPSG: 4674 / 31983)\n- **Fuso UTM:** 23S (Meridiano Central: 45°W)\n- **Parâmetros de Translação:** DX = 0.00m, DY = 0.00m, DZ = 0.00m (Compatibilidade nativa com WGS 84 para fins de navegação GNSS de precisão standard).`;
      } else {
        reply = `🛰️ **Diagnóstico Geoespacial de Campo:**\nCom base na camada ativa e na telemetria atual da posição (${currentGps.lat.toFixed(5)}, ${currentGps.lng.toFixed(5)}), o terreno apresenta altitude de ${currentGps.altitude}m. Recomenda-se manter o registro contínuo dos marcos geodésicos e atentar para as áreas de preservação permanente (APP) nas proximidades das drenagens.`;
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: reply,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85dvh] h-[580px] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 text-white flex items-center justify-center shadow">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Assistente SIG & Inteligência de Campo</h3>
              <p className="text-[11px] text-slate-400">Análise de relevo, cálculo geodésico e relatórios</p>
            </div>
          </div>

          <button
            id="btn-close-ai-modal"
            onClick={() => setIsAiModalOpen(false)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Stream */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3 text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`p-3 rounded-2xl max-w-[85%] whitespace-pre-line leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-800/90 text-slate-200 border border-slate-700'
                }`}
              >
                {msg.text}
              </div>

              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2 items-center text-xs text-slate-400 italic">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
              Processando análise geoespacial...
            </div>
          )}
        </div>

        {/* Suggested Quick Prompts */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/40 flex gap-1.5 overflow-x-auto text-[11px]">
          <button
            onClick={() => setInputPrompt('Gerar parecer técnico resumido deste projeto')}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap transition-colors"
          >
            📄 Parecer Técnico
          </button>
          <button
            onClick={() => setInputPrompt('Como converter coordenadas para UTM Fuso 23S SIRGAS 2000?')}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap transition-colors"
          >
            🌐 Conversão UTM/SIRGAS
          </button>
          <button
            onClick={() => setInputPrompt('Calcular declividade média da trilha gravada')}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap transition-colors"
          >
            ⛰️ Análise de Declividade
          </button>
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-950/70 flex gap-2">
          <input
            type="text"
            placeholder="Pergunte sobre coordenadas, normas ambientais, camadas ou relatórios..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-bold text-xs flex items-center gap-1 shadow-lg"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
