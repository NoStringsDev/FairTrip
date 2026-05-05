/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_FORCE_TEST_FX?: "0" | "1";
  readonly VITE_ENABLE_PWA_LOCAL?: "0" | "1";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
