/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_TONCONNECT_MANIFEST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
