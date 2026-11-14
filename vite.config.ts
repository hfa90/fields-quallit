import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const build = (process.env.GITHUB_SHA || 'local').slice(0, 7)
  return {
    base: env.VITE_BASE || '/',
    plugins: [react(), tailwindcss(), {
      // versão publicada, para o aviso "Nova versão disponível" de quem está com o site aberto
      name: 'fq-site-version',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'downloads/site.json', source: JSON.stringify({ version: pkg.version, build: build }) })
      },
    }],
    // Versão do sistema exibida no Perfil, na Administração e no login
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_BUILD__: JSON.stringify(build),
      __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    },
    build: { chunkSizeWarningLimit: 1500 },
  }
})
