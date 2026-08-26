import React, { useState } from 'react';
import {
  ShieldCheck,
  FileText,
  X,
  Lock,
  Scale,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Building2,
  ExternalLink,
  ChevronRight,
  BookOpen,
} from 'lucide-react';

interface LegalPoliciesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegalPoliciesModal: React.FC<LegalPoliciesModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<'all' | 'terms' | 'privacy'>('all');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-sm sm:text-base text-white truncate flex items-center gap-2">
                <span>Termos de Uso & Privacidade</span>
                <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  LGPD
                </span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                GoField Pro • AM TST Saúde e Segurança do Trabalho / Gestão Florestal
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtabs Filter */}
        <div className="grid grid-cols-3 p-1.5 sm:p-2 bg-slate-950/60 border-b border-slate-800 text-[11px] sm:text-xs font-bold gap-1 sm:gap-1.5 shrink-0">
          <button
            onClick={() => setActiveSection('all')}
            className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeSection === 'all'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Documento Completo</span>
          </button>

          <button
            onClick={() => setActiveSection('terms')}
            className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeSection === 'terms'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Parte I: Termos de Uso</span>
          </button>

          <button
            onClick={() => setActiveSection('privacy')}
            className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeSection === 'privacy'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Parte II: LGPD & Dados</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
          {/* Header Metadata Info Box */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-2.5">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Aplicativo & Titularidade
                </span>
                <span className="font-extrabold text-white text-sm">GoField Pro</span>
              </div>
              <div className="sm:text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Última Atualização
                </span>
                <span className="font-mono text-emerald-400 font-bold text-xs">25 de agosto de 2026</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 space-y-1">
              <p>
                <b>Desenvolvedora e Titular:</b> AM TST Saúde e Segurança do Trabalho / Gestão Florestal e Topografia
              </p>
              <p>
                <b>Canal de Atendimento & DPO:</b>{' '}
                <a href="mailto:apoioamtst@gmail.com" className="text-sky-400 underline font-mono font-bold">
                  apoioamtst@gmail.com
                </a>
              </p>
            </div>

            <div className="pt-2 text-slate-300 text-xs leading-relaxed border-t border-slate-850">
              Bem-vindo(a) ao <b>GoField Pro</b>. Este documento constitui um acordo legal e vinculante entre você (doravante <b>"Usuário"</b> ou <b>"Contratante"</b>) e a <b>AM TST</b> (doravante <b>"Provedora"</b>). Ao acessar, instalar ou utilizar o aplicativo, você concorda integralmente com as disposições aqui estabelecidas.
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PARTE I: TERMOS DE USO                                                    */}
          {/* ========================================================================= */}
          {(activeSection === 'all' || activeSection === 'terms') && (
            <section className="space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <FileText className="w-5 h-5 text-sky-400 shrink-0" />
                <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight uppercase">
                  PARTE I: TERMOS DE USO
                </h3>
              </div>

              {/* 1. Objeto e Natureza do Serviço */}
              <div className="space-y-1.5 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-850">
                <h4 className="font-bold text-white text-xs sm:text-sm text-sky-300">
                  1. Objeto e Natureza do Serviço
                </h4>
                <p>
                  O <b>GoField Pro</b> é um software fornecido no modelo <i>Software as a Service</i> (SaaS), voltado estritamente para o <b>uso corporativo e profissional (B2B)</b>. O aplicativo oferece ferramentas de engenharia, navegação GPS geodésica, topografia, cubagem florestal e auditorias de campo, não se destinando ao uso recreativo ou doméstico. A licença concedida é revogável, não exclusiva, intransferível e limitada ao escopo do plano contratado.
                </p>
              </div>

              {/* 2. Acesso, Cadastro e Credenciamento */}
              <div className="space-y-1.5 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-850">
                <h4 className="font-bold text-white text-xs sm:text-sm text-sky-300">
                  2. Acesso, Cadastro e Credenciamento
                </h4>
                <p>
                  • <b>Validação Prévia:</b> O acesso à plataforma não é automático. A criação e liberação de contas estão sujeitas à aprovação prévia do Super Administrador da AM TST e à verificação de identidade via WhatsApp comercial.
                </p>
                <p>
                  • <b>Segurança da Conta:</b> O Usuário é inteiramente responsável por manter a confidencialidade de suas credenciais. É estritamente proibido o compartilhamento de logins entre diferentes profissionais que não integrem a mesma licença corporativa específica.
                </p>
              </div>

              {/* 3. Planos, Faturamento e Inadimplência */}
              <div className="space-y-1.5 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-850">
                <h4 className="font-bold text-white text-xs sm:text-sm text-sky-300">
                  3. Planos, Faturamento e Inadimplência
                </h4>
                <p>
                  • <b>Modalidades:</b> O serviço é oferecido sob planos mensais e corporativos (Plano Profissional, Plano Equipe e Florestal & Usinas).
                </p>
                <p>
                  • <b>Pagamento:</b> Os pagamentos deverão ser efetuados via Pix Direto ou mediante Faturamento Pessoa Jurídica (Boleto/Transferência), conforme acordado no momento da contratação.
                </p>
                <p>
                  • <b>Suspensão por Inadimplência:</b> Em caso de inadimplência superior a <b>7 (sete) dias</b>, a Provedora reserva-se o direito de suspender temporariamente o acesso ao aplicativo. O cancelamento definitivo da conta e exclusão dos dados armazenados em nuvem poderá ocorrer após <b>30 (trinta) dias de atraso</b>, sem prejuízo da cobrança dos valores devidos.
                </p>
              </div>

              {/* 4. Responsabilidade Técnica e Operacional */}
              <div className="space-y-1.5 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-850">
                <h4 className="font-bold text-white text-xs sm:text-sm text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>4. Responsabilidade Técnica e Operacional (Cláusula de Isenção)</span>
                </h4>
                <p>
                  • <b>Autonomia Profissional:</b> O GoField Pro é uma ferramenta de auxílio técnico. A Provedora não se responsabiliza pela acurácia técnica, imperícia, imprudência ou negligência do operador em campo.
                </p>
                <p>
                  • <b>Dados de Topografia e Cubagem:</b> A precisão das coordenadas coletadas (WGS84, UTM/SIRGAS 2000), os lançamentos de cubagem florestal e os cálculos volumétricos (métodos de Smalian, Huber, entre outros) dependem da qualidade do hardware do dispositivo do Usuário e da expertise do profissional. O aplicativo não substitui a calibração de equipamentos oficiais (Estações Totais, RTK) nem a emissão de Anotação de Responsabilidade Técnica (ART) junto aos conselhos de classe (CREA/CFTA).
                </p>
              </div>

              {/* 5. Propriedade Intelectual */}
              <div className="space-y-1.5 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-850">
                <h4 className="font-bold text-white text-xs sm:text-sm text-sky-300">
                  5. Propriedade Intelectual
                </h4>
                <p>
                  Todo o código-fonte, algoritmos de cálculo, design, marcas e infraestrutura do GoField Pro são de propriedade exclusiva da <b>AM TST</b>, protegidos pela Lei de Direitos Autorais (Lei nº 9.610/98) e Lei de Propriedade Industrial (Lei nº 9.279/96).
                </p>
              </div>
            </section>
          )}

          {/* ========================================================================= */}
          {/* PARTE II: POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS (LGPD)              */}
          {/* ========================================================================= */}
          {(activeSection === 'all' || activeSection === 'privacy') && (
            <section className="space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight uppercase">
                  PARTE II: POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS (LGPD)
                </h3>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-3.5 text-slate-300 text-xs">
                A <b>AM TST</b> atua como <b>Controladora</b> dos dados cadastrais do cliente e como <b>Operadora</b> dos dados inseridos no aplicativo durante as atividades de campo, comprometendo-se com a privacidade, confidencialidade e segurança rigorosa de todas as informações.
              </div>

              {/* 1. Dados Pessoais e Operacionais Coletados */}
              <div className="space-y-1.5 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-850">
                <h4 className="font-bold text-white text-xs sm:text-sm text-emerald-300">
                  1. Dados Pessoais e Operacionais Coletados
                </h4>
                <p>Para o funcionamento adequado do GoField Pro, coletamos e processamos:</p>
                <ul className="space-y-1 pl-3 list-disc text-slate-300">
                  <li>
                    <b>Dados Cadastrais:</b> Nome completo, e-mail, telefone/WhatsApp, empresa vinculada e CNPJ.
                  </li>
                  <li>
                    <b>Dados de Localização (GPS/GNSS):</b> Coletamos coordenadas de latitude, longitude e altitude em tempo real e em segundo plano (background) quando o usuário ativa a gravação de trilhas geodésicas e mapeamento.
                  </li>
                  <li>
                    <b>Arquivos e Mídia:</b> Captura de fotos (marcos topográficos, vistorias, pilhas de madeira, odômetro) e acesso ao armazenamento para importação e leitura de arquivos técnicos (PDF, KML e KMZ).
                  </li>
                </ul>
              </div>

              {/* 2. Finalidade e Base Legal */}
              <div className="space-y-1.5 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-850">
                <h4 className="font-bold text-white text-xs sm:text-sm text-emerald-300">
                  2. Finalidade e Base Legal (Art. 7º da LGPD)
                </h4>
                <p>
                  • <b>Execução de Contrato (Art. 7º, V):</b> Necessário para a prestação do serviço SaaS, criação de contas, faturamento, suporte técnico e funcionamento das ferramentas de mapa e cálculo.
                </p>
                <p>
                  • <b>Legítimo Interesse e Prevenção à Fraude (Art. 7º, IX e X):</b> Coleta de logs de auditoria, registros de acesso (IP, data e hora) em conformidade com o Marco Civil da Internet.
                </p>
              </div>

              {/* 3. Arquitetura de Dados: Offline e Nuvem */}
              <div className="space-y-1.5 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-850">
                <h4 className="font-bold text-white text-xs sm:text-sm text-emerald-300">
                  3. Arquitetura de Dados: Offline e Nuvem (Zero Latência)
                </h4>
                <p>
                  • <b>Processamento Local (Edge Computing):</b> A renderização de mapas PDF e os cálculos matemáticos complexos são executados localmente no hardware do dispositivo do Usuário (via IndexedDB e Cache Storage), garantindo funcionamento em áreas remotas sem internet.
                </p>
                <p>
                  • <b>Sincronização Segura:</b> Quando há conexão, os dados são sincronizados, através de criptografia de ponta a ponta (TLS/SSL), com nossos servidores hospedados no Google Cloud / Firebase Firestore, garantindo o backup de projetos, logs de auditoria e cadastros.
                </p>
              </div>

              {/* 4. Compartilhamento de Dados */}
              <div className="space-y-1.5 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-850">
                <h4 className="font-bold text-white text-xs sm:text-sm text-emerald-300">
                  4. Compartilhamento de Dados
                </h4>
                <p>
                  <b>Nós não comercializamos, alugamos ou compartilhamos seus dados ou projetos de campo com terceiros para fins publicitários ou de marketing.</b> O compartilhamento restringe-se exclusivamente aos nossos provedores de infraestrutura de nuvem (Google Cloud) essenciais para a operação do sistema, que atuam sob rigorosos contratos de confidencialidade técnica.
                </p>
              </div>

              {/* 5. Retenção e Exclusão de Dados */}
              <div className="space-y-1.5 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-850">
                <h4 className="font-bold text-white text-xs sm:text-sm text-emerald-300">
                  5. Retenção e Exclusão de Dados
                </h4>
                <p>
                  Os dados serão armazenados pelo tempo em que a licença estiver ativa ou pelo período exigido por leis fiscais e pelo Marco Civil da Internet (guarda de logs por 6 meses).
                </p>
                <p>
                  • <b>Direito ao Esquecimento/Exclusão:</b> O Usuário ou a Empresa Contratante poderá solicitar a exclusão definitiva de seus dados e projetos dos nossos servidores (Cloud) a qualquer momento, mediante solicitação formal. Ressalta-se que a exclusão dos dados inviabiliza a continuidade do uso do aplicativo.
                </p>
              </div>

              {/* 6. Direitos do Titular */}
              <div className="space-y-1.5 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-850">
                <h4 className="font-bold text-white text-xs sm:text-sm text-emerald-300">
                  6. Direitos do Titular (Art. 18 da LGPD)
                </h4>
                <p>
                  Você tem o direito de solicitar a confirmação do tratamento, acesso aos dados, correção de dados incompletos ou desatualizados, portabilidade e revogação do consentimento (quando aplicável).
                </p>
              </div>

              {/* 7. Canal Oficial de Contato (DPO) */}
              <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-sky-500/40">
                <h4 className="font-bold text-white text-xs sm:text-sm text-sky-400 flex items-center gap-1.5">
                  <Mail className="w-4 h-4" />
                  <span>7. Canal Oficial de Contato (Encarregado de Dados - DPO)</span>
                </h4>
                <p>
                  Para exercer seus direitos previstos na LGPD, dirimir dúvidas sobre esta política ou relatar incidentes de segurança, entre em contato com nosso Encarregado de Proteção de Dados (DPO) através dos canais oficiais:
                </p>
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1 font-mono text-xs">
                  <p>
                    ✉️ <b>E-mail Oficial:</b>{' '}
                    <a href="mailto:apoioamtst@gmail.com" className="text-emerald-400 font-bold underline">
                      apoioamtst@gmail.com
                    </a>
                  </p>
                  <p>
                    📱 <b>WhatsApp Comercial / Suporte:</b> Disponível no painel administrativo do aplicativo.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Acceptance Footer Note */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-[11px] text-slate-400 text-center">
            Ao realizar o login e utilizar o <b>GoField Pro</b>, o usuário declara ter lido, compreendido e concordado com todos os termos e políticas descritos neste documento.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/90 shrink-0">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            AM TST • Segurança & Gestão de Campo
          </span>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-sky-600/20 cursor-pointer ml-auto"
          >
            Entendido / Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
