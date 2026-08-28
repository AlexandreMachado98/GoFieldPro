// Centralized App Version and Build Metadata
export const APP_VERSION = 'v2.6.0';
export const APP_BUILD_NUMBER = 260;
export const APP_BUILD_DATE = '27/08/2026';
export const APP_RELEASE_NAME = 'GoField Pro Tactical 2.6.0';

export interface ChangelogItem {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const APP_CHANGELOG: ChangelogItem[] = [
  {
    version: 'v2.6.0',
    date: '27/08/2026',
    title: 'Controle Dinâmico de Planos na Vitrine & Isolamento Multiusuário',
    highlights: [
      'Controle rigoroso e sincronizado de visibilidade de planos (ocultação/ativação instantânea).',
      'Isolamento estrito de armazenamento local e memória RAM por usuário (UID).',
      'Botão de Verificação de Atualizações e Limpeza Segura de Cache no menu lateral e barra superior.',
      'Liberação de regras do Firestore para sincronização em tempo real de configurações de cobrança.',
    ],
  },
  {
    version: 'v2.5.0',
    date: '26/08/2026',
    title: 'Motor KML/KMZ Ultra-Resiliente & Atualização Forçada',
    highlights: [
      'Leitura ultra-resiliente de arquivos KML/KMZ em múltiplos padrões de GIS, Google Earth e CAD.',
      'Auto-calibração e enquadramento automático de visão (auto-zoom) nos pontos e trilhas do KML.',
      'Suporte para pacotes KMZ com múltiplos sub-arquivos KML e fotos georreferenciadas.',
      'Mecanismo de auto-limpeza de cache e sincronização forçada para celulares e navegadores.',
    ],
  },
  {
    version: 'v2.4.0',
    date: '25/08/2026',
    title: 'Pilha de Madeira, Tema Claro/Escuro & Atualização Automática PWA',
    highlights: [
      'Nova ferramenta dedicada de Apontamento e Medição de Pilha de Madeira com cubagem automática (estéreo e m³ sólido).',
      'Modo Claro (Luz Solar) e Modo Escuro com contraste aprimorado para trabalho sob sol intenso.',
      'Barra do mapa limpa e botão de Camadas unificado.',
      'Sistema de atualização automática contínua para celulares instalados via PWA.',
    ],
  },
];
