/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ATTESTATION_HUB_ADDRESS: string;
  readonly VITE_AMOY_RPC_URL: string;
  /** https://cloud.walletconnect.com — enables QR connect without a browser extension */
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  ethereum?: unknown;
}
