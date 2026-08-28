/**
 * Build-Time Dynamic Version Generator for GoField Pro
 * Stamped automatically during 'npm run build' on Vercel
 */
const fs = require('fs');
const path = require('path');

const now = new Date();
const timestamp = now.getTime();
const buildDate = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const buildTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const buildNumber = timestamp;
const version = 'v2.6.' + Math.floor((timestamp - 1740000000000) / 1000000);

console.log(`[Build-Stamp] Gerando Build #${buildNumber} (${version}) em ${buildDate} ${buildTime}`);

// 1. Generate public/version.json
const versionJsonContent = {
  version: version,
  buildNumber: buildNumber,
  buildDate: buildDate,
  buildTime: buildTime,
  releaseTimestamp: timestamp,
  minSupportedVersion: 'v2.0.0',
  description: `GoField Pro - Build ${version} (${buildDate} ${buildTime})`
};

fs.writeFileSync(path.resolve('public/version.json'), JSON.stringify(versionJsonContent, null, 2), 'utf8');
console.log('[Build-Stamp] Atualizado public/version.json com sucesso');

// 2. Generate src/config/version.ts
const versionTsContent = `// Centralized App Version and Build Metadata - Auto-generated at Build Time
export const APP_VERSION = '${version}';
export const APP_BUILD_NUMBER = ${buildNumber};
export const APP_BUILD_DATE = '${buildDate}';
export const APP_BUILD_TIME = '${buildTime}';
export const APP_RELEASE_TIMESTAMP = ${timestamp};
export const APP_RELEASE_NAME = 'GoField Pro Tactical ${version}';

export interface ChangelogItem {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const APP_CHANGELOG: ChangelogItem[] = [
  {
    version: '${version}',
    date: '${buildDate}',
    title: 'Atualização Contínua de Campo & Sincronização em Tempo Real',
    highlights: [
      'Garantia de atualização automática instantânea em cada deploy da Vercel.',
      'Invalidação automática de cache de Service Worker e recarregamento sem intervenção manual.',
      'Controle Dinâmico de Planos na Vitrine e Isolamento Multiusuário.',
      'Motor de GPS de Alta Precisão e Laudos Técnicos AM TST.'
    ]
  }
];
`;

fs.writeFileSync(path.resolve('src/config/version.ts'), versionTsContent, 'utf8');
console.log('[Build-Stamp] Atualizado src/config/version.ts com sucesso');

// 3. Inject unique Cache Name into public/sw.js
const swPath = path.resolve('public/sw.js');
if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf8');
  swContent = swContent.replace(
    /const CACHE_NAME = ['"`][^'"`]+['"`];/,
    `const CACHE_NAME = 'gofield-pro-build-${buildNumber}';`
  );
  swContent = swContent.replace(
    /// Build-Timestamp: .*/,
    `// Build-Timestamp: ${timestamp} (${buildDate} ${buildTime})`
  );
  if (!swContent.includes('// Build-Timestamp:')) {
    swContent = `// Build-Timestamp: ${timestamp} (${buildDate} ${buildTime})
` + swContent;
  }
  fs.writeFileSync(swPath, swContent, 'utf8');
  console.log('[Build-Stamp] Injetado CACHE_NAME dinâmico em public/sw.js');
}
