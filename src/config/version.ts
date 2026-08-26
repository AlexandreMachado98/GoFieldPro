// Centralized App Version and Build Metadata
export const APP_VERSION = 'v2.4.0';
export const APP_BUILD_NUMBER = 240;
export const APP_BUILD_DATE = '25/08/2026';
export const APP_RELEASE_NAME = 'GoField Pro Tactical 2.4';

export interface ChangelogItem {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const APP_CHANGELOG: ChangelogItem[] = [
  {
    version: 'v2.4.0',
    date: '25/08/2026',
    title: 'Pilha de Madeira, Tema Claro/Escuro & Atualização Automática PWA',
    highlights: [
      'Nova ferramenta dedicada de Apontamento e Medição de Pilha de Madeira com cubagem automática (estéreo e m³ sólido).',
      'Modo Claro (Luz Solar) e Modo Escuro com contraste aprimorado para trabalho sob sol intenso.',
      'Barra do mapa limpa e botão de Camadas unificado.',
      'Sistema de atualização automática contínua para celulares instalados via PWA.',
      'Otimizações anti-superaquecimento e economia extrema de bateria.',
    ],
  },
  {
    version: 'v2.3.0',
    date: '20/08/2026',
    title: 'Gravação de Trilhas em Tempo Real & Régua Geodésica',
    highlights: [
      'Gravação de trilhas GPS em tempo real na folha PDF com odômetro integrado.',
      'Régua geodésica multiponto para cálculo de perímetro e área.',
      'Exportação de relatórios técnicos em PDF com dossiê fotográfico.',
    ],
  },
];
