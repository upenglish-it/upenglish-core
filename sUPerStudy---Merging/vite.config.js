import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import dotenv from 'dotenv'

function dynamicEnvPlugin(mode) {
  const virtualModuleId = 'virtual:dynamic-env'
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  return {
    name: 'dynamic-env',
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId
      }
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        if (mode === 'development') {
          // Parse .env freshly on every load (reload) in dev
          const envConfig = dotenv.parse(fs.readFileSync('.env'));
          return `export const getDynamicEnv = () => (${JSON.stringify(envConfig)});`;
        } else {
          // Return empty in production, aiService will fallback to import.meta.env
          return `export const getDynamicEnv = () => ({});`;
        }
      }
    }
  }
}

// Load ALL env vars (including non-VITE_ prefixed) for dev mode
dotenv.config()
// Load .env.local overrides (if exists) — takes priority over .env
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true })
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), dynamicEnvPlugin(mode)],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  appType: 'spa',
  define: mode === 'development' || mode === 'production' ? {
    // Inject API keys and models into the build (Only API keys, models use dynamic env)
    'import.meta.env.DEV_GOOGLE_API_KEY': JSON.stringify(process.env.GOOGLE_API_KEY_FREE || process.env.GOOGLE_API_KEY_PAID || ''),
    'import.meta.env.DEV_OPENROUTER_API_KEY': JSON.stringify(process.env.OPENROUTER_API_KEY_FREE || process.env.OPENROUTER_API_KEY_PAID || ''),
  } : {},
}))
