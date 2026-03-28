import { createConfig, http } from "wagmi";
import { polygonAmoy } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const rpc =
  import.meta.env.VITE_AMOY_RPC_URL ?? "https://rpc-amoy.polygon.technology";

const wcId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;

const connectors = [
  injected({ shimDisconnect: true }),
  ...(wcId
    ? [
        walletConnect({
          projectId: wcId,
          showQrModal: true,
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [polygonAmoy],
  connectors,
  transports: {
    [polygonAmoy.id]: http(rpc),
  },
});

export function hasBrowserWalletProvider(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export function walletConnectEnabled(): boolean {
  return Boolean(wcId);
}
