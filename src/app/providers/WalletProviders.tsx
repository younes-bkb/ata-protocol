"use client";

import { ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";

const DEFAULT_RPC_ENDPOINT = "https://api.mainnet-beta.solana.com";
const ENV_RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT?.trim();

type WalletProvidersProps = {
  children: ReactNode;
};

export default function WalletProviders({ children }: WalletProvidersProps) {
  const endpoint = useMemo(
    () => ENV_RPC_ENDPOINT && ENV_RPC_ENDPOINT.length > 0 ? ENV_RPC_ENDPOINT : DEFAULT_RPC_ENDPOINT,
    [],
  );
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new TorusWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
