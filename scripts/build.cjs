const path = require('path');

async function runBuild() {
  try {
    // 1. Run dynamic build version stamper
    require('./generate-build-version.cjs');

    // 2. Programmatically invoke Vite Build API (100% resilient across Windows and Vercel)
    console.log('[Build] Compilando assets com Vite API...');
    const { build } = await import('vite');
    await build({
      configFile: path.resolve(__dirname, '../vite.config.ts'),
      root: path.resolve(__dirname, '..'),
    });
    console.log('[Build] ✅ Deploy Bundle gerado com sucesso!');
  } catch (err) {
    console.error('[Build] ❌ Erro durante build:', err);
    process.exit(1);
  }
}

runBuild();
