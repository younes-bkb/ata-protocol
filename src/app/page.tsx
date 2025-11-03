"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { createCloseAccountInstruction } from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";
import { BackgroundRippleEffect } from "@/components/ui/background-ripple-effect";
import { GoogleGeminiEffect } from "@/components/aceternity/google-gemini-effect";
import { LampEffect } from "@/components/aceternity/lamp-effect";
import { LensEffect } from "@/components/aceternity/lens-effect";
import { SocialDock } from "@/components/social-dock";

type RequestState = "idle" | "loading" | "error" | "success";

type RentRecoveryAccount = {
  ataAddress: string;
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number | null;
  uiAmountString: string;
  state: string;
  isFrozen: boolean;
};

type RentRecoveryResult = {
  walletAddress: string;
  reclaimableSOL: number;
  reclaimableSOLFormatted: string;
  totalATAs: number;
  emptyATAs: number;
  rentPerATA: number;
  accounts: RentRecoveryAccount[];
};

type ConsultMode = "wallet" | "manual";

type WelcomeRewardState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "minted"; mintAddress: string; signature: string }
  | { status: "already"; mintAddress: string | null }
  | { status: "error"; message: string };

const navItems = [
  { label: "Narration", href: "#narration" },
  { label: "Tokenomics", href: "#tokenomics" },
  { label: "Roadmap", href: "#roadmap" },
  { label: "Consult", href: "#consult" },
  { label: "Voice Chain", href: "/voice" },
];

const featureCards = [
  {
    title: "White Pepper",
    description:
      "A punchy creative sprint that seasons every release with bold storytelling cues.",
  },
  {
    title: "Narrative",
    description:
      "A cohesive lore bible that keeps the ATA universe aligned across product launches.",
  },
  {
    title: "NFT",
    description:
      "Collectible passes that unlock gated treasury experiments and early feature drops.",
  },
  {
    title: "Voice Chain",
    description:
      "Live war rooms where builders and governors sync strategy in real time.",
  },
];

const heroMetrics = [
  { label: "Target TPS", value: "65k+" },
  { label: "Target TVL", value: "$1.2B" },
  { label: "Active Builders", value: "350k+" },
];

const tokenomics = [
  {
    label: "Total Supply",
    value: "1,000,000,000 $ATA",
    helper: "Fixed supply, no additional minting planned.",
  },
  {
    label: "Circulating at TGE",
    value: "18%",
    helper: "Progressive unlocking over 36 months.",
  },
  {
    label: "Ecosystem Treasury",
    value: "24%",
    helper: "Grant and incentive programs for builders.",
  },
  {
    label: "Initial Liquidity",
    value: "25%",
    helper: "SOL / USDC / $ATA pools from launch.",
  },
];

const supplyBreakdown = [
  { label: "Community & Airdrops", value: "20%" },
  { label: "Team & Advisors", value: "12%" },
  { label: "Partner Validators", value: "9%" },
  { label: "R&D Foundation", value: "10%" },
  { label: "Strategic Liquidity", value: "24%" },
  { label: "DAO Reserves", value: "5%" },
];

const roadmap = [
  {
    quarter: "Q1 2025",
    title: "Mainnet Launch",
    description:
      "Deployment of ATA smart contracts and opening of the first liquidity pools.",
  },
  {
    quarter: "Q2 2025",
    title: "Multi-chain Bridge",
    description:
      "Connection with Ethereum, Base and BSC to make ATAs interoperable.",
  },
  {
    quarter: "Q3 2025",
    title: "Governance DAO",
    description:
      "Activation of the on-chain voting module for protocol decisions.",
  },
  {
    quarter: "Q4 2025",
    title: "ATA Reclaim Suite",
    description:
      "Launch of the one-click reclaim tool with automated ATA closures.",
  },
];

const RECLAIM_CHUNK_SIZE = 6;
const MAX_ATA_PREVIEW = 6;

function chunkArray<T>(array: T[], size: number): T[][] {
  if (size <= 0) {
    return [array];
  }
  const chunks: T[][] = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
}

export default function Home() {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();
  const [consultMode, setConsultMode] = useState<ConsultMode>("wallet");
  const [manualAddress, setManualAddress] = useState("");
  const [hasMounted, setHasMounted] = useState(false);
  const [status, setStatus] = useState<RequestState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<RentRecoveryResult | null>(null);
  const [reclaiming, setReclaiming] = useState(false);
  const [reclaimError, setReclaimError] = useState("");
  const [reclaimSuccess, setReclaimSuccess] = useState<string | null>(null);
  const [reclaimSignatures, setReclaimSignatures] = useState<string[]>([]);
  const [rewardState, setRewardState] = useState<WelcomeRewardState>({
    status: "idle",
  });

  const lastFetchedWalletRef = useRef<string | null>(null);

  const shortAddress = useMemo(() => {
    if (!publicKey) {
      return "";
    }
    const base58 = publicKey.toBase58();
    return `${base58.slice(0, 4)}…${base58.slice(-4)}`;
  }, [publicKey]);

  const walletBase58 = useMemo(() => publicKey?.toBase58() ?? null, [publicKey]);

  const trimmedManualAddress = useMemo(
    () => manualAddress.trim(),
    [manualAddress],
  );

  const isWalletMode = consultMode === "wallet";
  const isWalletReady = connected && !!publicKey;
  const canFetch =
    status !== "loading" &&
    (isWalletMode ? isWalletReady : trimmedManualAddress.length > 0);
  const idleMessage = isWalletMode
    ? "Connect your wallet to discover the reclaimable SOL."
    : "Enter a Solana address and start the analysis.";
  const viewStatus: RequestState =
    isWalletMode && !isWalletReady ? "idle" : status;
  const viewErrorMessage =
    isWalletMode && !isWalletReady ? "" : errorMessage;
  const viewResult = isWalletMode && !isWalletReady ? null : result;
  const resultAccounts = viewResult?.accounts ?? [];
  const ownedResult =
    Boolean(walletBase58) && viewResult?.walletAddress === walletBase58;
  const canReclaim =
    isWalletMode && ownedResult && (viewResult?.emptyATAs ?? 0) > 0;
  const emptyAtasCount = viewResult?.emptyATAs ?? 0;
  const totalAtasCount = viewResult?.totalATAs ?? 0;
  const previewAccounts = resultAccounts.slice(0, MAX_ATA_PREVIEW);
  const remainingAccounts = Math.max(
    resultAccounts.length - previewAccounts.length,
    0,
  );
  const reclaimButtonLabel = reclaiming
    ? "Reclaiming..."
    : `Reclaim ${emptyAtasCount} ATA${emptyAtasCount > 1 ? "s" : ""}`;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    setRewardState({ status: "idle" });
  }, [walletBase58, consultMode]);

  const fetchAtaBalance = useCallback(
    async (address: string) => {
      const normalizedAddress = address.trim();
      if (!normalizedAddress) {
        setErrorMessage(
          "Please enter a valid Solana wallet address.",
        );
        return;
      }

      setStatus("loading");
      setErrorMessage("");
      setResult(null);
      setReclaimError("");
      setReclaimSuccess(null);
      setReclaimSignatures([]);

      try {
        const response = await fetch("/api/ata-balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: normalizedAddress,
          }),
        });

        const payload = await response.json();

        if (!response.ok || payload.success === false) {
          setStatus("error");
          setErrorMessage(
            payload?.message ??
              "An error occurred while fetching data.",
          );
          return;
        }

        setResult({
          walletAddress: payload.walletAddress,
          reclaimableSOL: payload.reclaimableSOL,
          reclaimableSOLFormatted: payload.reclaimableSOLFormatted,
          totalATAs: payload.totalATAs,
          emptyATAs: payload.emptyATAs,
          rentPerATA: payload.rentPerATA,
          accounts: payload.accounts ?? [],
        });
        setStatus("success");
      } catch (error) {
        console.error(error);
        setStatus("error");
        setErrorMessage(
          "Could not contact the API. Check your network connection or the RPC.",
        );
      }
    },
    [],
  );

  useEffect(() => {
    if (!isWalletMode) {
      lastFetchedWalletRef.current = null;
      setReclaimError("");
      setReclaimSuccess(null);
      setReclaimSignatures([]);
      return;
    }

    if (!walletBase58) {
      lastFetchedWalletRef.current = null;
      return;
    }

    const currentKey = walletBase58;
    if (lastFetchedWalletRef.current === currentKey) {
      return;
    }

    lastFetchedWalletRef.current = currentKey;
    const timeoutId = setTimeout(() => {
      void fetchAtaBalance(currentKey);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isWalletMode, walletBase58, fetchAtaBalance]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (status === "loading") {
        return;
      }

      if (isWalletMode) {
        if (!isWalletReady || !walletBase58) {
          setStatus("error");
          setErrorMessage(
            "Connect your Solana wallet to start the analysis.",
          );
          return;
        }
        void fetchAtaBalance(walletBase58);
        return;
      }

      if (!trimmedManualAddress) {
        setStatus("error");
        setErrorMessage(
          "Please enter a valid Solana wallet address.",
        );
        return;
      }

      void fetchAtaBalance(trimmedManualAddress);
    },
    [
      status,
      isWalletMode,
      isWalletReady,
      walletBase58,
      trimmedManualAddress,
      fetchAtaBalance,
    ],
  );

  const handleReclaim = useCallback(async () => {
    if (!isWalletMode) {
      return;
    }

    if (!walletBase58 || !publicKey) {
      setReclaimError("Connect your Solana wallet to start the reclaim.");
      return;
    }

    if (!result || result.walletAddress !== walletBase58) {
      setReclaimError(
        "The displayed data does not match your connected wallet.",
      );
      return;
    }

    if (!result.accounts.length) {
      setReclaimError("No empty ATAs to close.");
      return;
    }

    setReclaiming(true);
    setReclaimError("");
    setReclaimSuccess(null);
    setReclaimSignatures([]);
    setRewardState({ status: "pending" });

    try {
      const chunks = chunkArray(result.accounts, RECLAIM_CHUNK_SIZE);
      const collectedSignatures: string[] = [];

      for (const chunk of chunks) {
        const instructions = chunk.map((account) =>
          createCloseAccountInstruction(
            new PublicKey(account.ataAddress),
            publicKey,
            publicKey,
          ),
        );

        const transaction = new Transaction().add(...instructions);
        transaction.feePayer = publicKey;

        const signature = await sendTransaction(transaction, connection, {
          preflightCommitment: "confirmed",
        });
        collectedSignatures.push(signature);

        await connection.confirmTransaction(signature, "confirmed");
      }

      const successMessage =
        collectedSignatures.length > 1
          ? `${collectedSignatures.length} transactions sent.`
          : "Transaction sent.";

      setReclaimSuccess(successMessage);
      setReclaimSignatures(collectedSignatures);

      await fetchAtaBalance(walletBase58);

      if (collectedSignatures.length === 0) {
        setRewardState({
          status: "error",
          message:
            "Reclaim signature unavailable, welcome NFT minting canceled.",
        });
        return;
      }

      try {
        const onboardingResponse = await fetch("/api/mint-onboarding-nft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: walletBase58,
            reclaimSignature: collectedSignatures[0],
          }),
        });

        const onboardingPayload = await onboardingResponse.json();

        if (onboardingResponse.ok && onboardingPayload?.success) {
          if (onboardingPayload.status === "already_minted") {
            setRewardState({
              status: "already",
              mintAddress: onboardingPayload.mintAddress ?? null,
            });
          } else if (
            onboardingPayload.mintAddress &&
            onboardingPayload.signature
          ) {
            setRewardState({
              status: "minted",
              mintAddress: onboardingPayload.mintAddress,
              signature: onboardingPayload.signature,
            });
          } else {
            setRewardState({
              status: "error",
              message:
                "Mint completed but information missing. Check Supabase / explorer.",
            });
          }
        } else {
          setRewardState({
            status: "error",
            message:
              onboardingPayload?.message ??
              "Could not mint the welcome NFT.",
          });
        }
      } catch (mintError) {
        console.error("Onboarding NFT mint failed", mintError);
        setRewardState({
          status: "error",
          message:
            "Could not access the welcome NFT mint at the moment. Try again later.",
        });
      }
    } catch (error) {
      console.error(error);
      setReclaimError(
        "Could not finalize the reclaim. Try again in a few moments.",
      );
      setRewardState({
        status: "error",
        message:
          "The reclaim did not complete, the welcome NFT could not be awarded.",
      });
      await fetchAtaBalance(walletBase58);
    } finally {
      setReclaiming(false);
    }
  }, [
    isWalletMode,
    walletBase58,
    publicKey,
    result,
    sendTransaction,
    connection,
    fetchAtaBalance,
  ]);

  const fadeUp = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.6, ease: "easeOut" as const },
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-100">
      <SocialDock />
      <BackgroundRippleEffect
        className="absolute inset-0 opacity-0"
        rows={10}
        cols={30}
        cellSize={54}
        autoPlay
        interactive
      />
      <div className="pointer-events-none absolute inset-0 opacity-0 bg-[radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.12),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(14,197,166,0.09),transparent_65%)]" />

      <header className="relative z-20 mx-auto mt-8 flex w-full max-w-6xl items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 via-indigo-500 to-purple-500 text-lg font-semibold text-slate-900 shadow-lg shadow-indigo-500/40">
            ◎
          </span>
          <span className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-200/80">
            ATA Protocol
          </span>
        </div>
        <nav className="hidden gap-6 text-xs uppercase tracking-[0.26em] text-slate-300/70 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition hover:-translate-y-0.5 hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <a
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-indigo-500 to-purple-500 px-5 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-900 shadow-lg shadow-indigo-500/40 transition hover:-translate-y-0.5 hover:shadow-indigo-400/60"
          href="#consult"
        >
          Consult a wallet
        </a>
      </header>

      <main className="relative z-20 mx-auto w-full max-w-6xl space-y-20 pb-28 pt-14">
        <motion.section
          id="hero"
          className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-10 shadow-[0_40px_140px_rgba(6,9,26,0.55)] backdrop-blur"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <LampEffect className="pointer-events-none absolute inset-0 opacity-0" />
          <div className="pointer-events-none absolute inset-0" />

          <div className="relative z-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="flex flex-col gap-6">

              <h1 className="text-6xl font-bold leading-tight text-slate-50 md:text-7xl lg:text-8xl bg-gradient-to-r from-emerald-400 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
                Associated<br />Token<br />Account
              </h1>

              <div className="flex flex-wrap gap-4">


              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {heroMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.08)] px-5 py-4 shadow-[0_18px_38px_rgba(8,10,30,0.45)] transition hover:-translate-y-1 hover:border-white/20"
                  >
                    <span className="text-2xl font-semibold text-white">{metric.value}</span>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-slate-300/60">
                      {metric.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-stretch justify-center">
              <div className="relative flex w-full flex-col items-center gap-6 overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/60 p-8 shadow-[0_28px_80px_rgba(4,6,24,0.55)]">
                <GoogleGeminiEffect className="pointer-events-none absolute inset-0 opacity-0"><div/></GoogleGeminiEffect>
                <div className="relative z-10 rounded-3xl bg-slate-950/80 p-6 ring-1 ring-white/10">
                  <Image
                    src="/mascotteATA.png"
                    alt="Official $ATA Mascot"
                    width={240}
                    height={240}
                    priority
                  />
                </div>
                <div className="relative z-10 space-y-2 text-center text-sm text-slate-300/80">
                  <p className="font-medium tracking-[0.28em] text-slate-200/70">
                    Reclaim Console
                  </p>
                  <p>
                    Real-time visualization of closed ATAs, released SOL and applied DAO rules.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          id="narration"
          className="space-y-10 rounded-[30px] border border-white/10 bg-white/10 p-10 shadow-[0_30px_90px_rgba(4,6,24,0.45)]"
          {...fadeUp}
        >
          <div className="space-y-4">
            <span className="text-xs uppercase tracking-[0.32em] text-slate-300/70">Narration</span>
            <h2 className="text-3xl font-semibold text-white">
              Modular primitives that automate the entire on-chain treasury.
            </h2>
            <p className="max-w-3xl text-base leading-relaxed text-slate-300/80">
              A builder-oriented stack: ultra-fast liquidity, programmable security, transparent governance. Each block can be integrated into your existing dApps in a few lines.
            </p>
          </div>
          <LensEffect className="overflow-hidden rounded-[26px] border border-white/10 bg-white/5 p-8">
            <div className="grid gap-6 md:grid-cols-2">
              {featureCards.map((card) => (
                <motion.article
                  key={card.title}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-[0_18px_36px_rgba(6,10,32,0.45)] transition hover:-translate-y-1 hover:border-white/20"
                  whileHover={{ translateY: -8, scale: 1.02 }}
                  transition={{ duration: 0.22 }}
                >
                  <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300/80">
                    {card.description}
                  </p>
                </motion.article>
              ))}
            </div>
          </LensEffect>
        </motion.section>

        <motion.section
          id="tokenomics"
          className="space-y-10 rounded-[30px] border border-white/10 bg-white/10 p-10 shadow-[0_30px_90px_rgba(4,6,24,0.45)]"
          {...fadeUp}
        >
          <div className="space-y-4">
            <span className="text-xs uppercase tracking-[0.32em] text-slate-300/70">Tokenomics</span>
            <h2 className="text-3xl font-semibold text-white">
              An economic model designed to align builders, validators and DAO treasury.
            </h2>
            <p className="max-w-3xl text-base leading-relaxed text-slate-300/80">
              $ATA finances network growth, liquefies treasuries and rewards partner validators. Each allocation has a long-term strategic role.
            </p>
          </div>

          <GoogleGeminiEffect className="rounded-[26px] border border-white/10 bg-slate-950/60 p-8">
            <div className="grid gap-6 md:grid-cols-2">
              {tokenomics.map((item) => (
                <motion.div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_40px_rgba(4,6,26,0.4)] transition hover:-translate-y-1 hover:border-white/20"
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ duration: 0.22 }}
                >
                  <span className="text-[11px] uppercase tracking-[0.3em] text-slate-300/60">
                    {item.label}
                  </span>
                  <strong className="mt-3 block text-2xl text-white">{item.value}</strong>
                  <p className="mt-2 text-sm text-slate-300/80">{item.helper}</p>
                </motion.div>
              ))}
            </div>
          </GoogleGeminiEffect>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <h3 className="text-sm uppercase tracking-[0.28em] text-slate-300/70">
              Projected Distribution
            </h3>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {supplyBreakdown.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200/80"
                >
                  <span>{item.label}</span>
                  <span className="font-medium text-white">{item.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.section>

        <motion.section
          id="roadmap"
          className="space-y-10 rounded-[30px] border border-white/10 bg-white/10 p-10 shadow-[0_30px_90px_rgba(4,6,24,0.45)]"
          {...fadeUp}
        >
          <div className="space-y-4">
            <span className="text-xs uppercase tracking-[0.32em] text-slate-300/70">Roadmap</span>
            <h2 className="text-3xl font-semibold text-white">
              From basic recovery to self-managed ATA agents.
            </h2>
            <p className="max-w-3xl text-base leading-relaxed text-slate-300/80">
              An ambitious trajectory to make ATAs intelligent, interoperable and community-governed.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {roadmap.map((item) => (
              <motion.article
                key={item.quarter}
                className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-[0_18px_40px_rgba(4,6,26,0.4)] transition hover:-translate-y-1 hover:border-white/20"
                whileHover={{ translateY: -6 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
              >
                <span className="text-[11px] uppercase tracking-[0.28em] text-slate-300/60">
                  {item.quarter}
                </span>
                <h3 className="mt-3 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-300/80">{item.description}</p>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section
          id="consult"
          className="space-y-10 rounded-[30px] border border-white/10 bg-white/10 p-10 shadow-[0_30px_90px_rgba(4,6,24,0.45)]"
          {...fadeUp}
        >
          <div className="space-y-4">
            <span className="text-xs uppercase tracking-[0.32em] text-slate-300/70">
              ATA Consultation
            </span>
            <h2 className="text-3xl font-semibold text-white">
              Visualize the immobilized SOL, trigger the recovery in a few seconds.
            </h2>
            <p className="max-w-3xl text-base leading-relaxed text-slate-300/80">
              Analyze any Solana address, get the recoverable amount and let the protocol close the ATAs for you. All requests go through the RPC endpoint configured on the server side.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)]">
            <motion.form
              className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-slate-950/60 p-6"
              onSubmit={handleSubmit}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              <div
                className="inline-flex self-start rounded-full border border-white/10 bg-white/5 p-1 text-[11px] uppercase tracking-[0.22em] text-slate-300/70"
                role="radiogroup"
                aria-label="Consultation Mode"
              >
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 transition ${
                    isWalletMode
                      ? "bg-gradient-to-r from-emerald-400/70 via-indigo-500/70 to-purple-500/70 text-slate-900 shadow-lg shadow-indigo-500/30"
                      : "text-slate-300/70 hover:text-white"
                  }`}
                  role="radio"
                  aria-checked={isWalletMode}
                  onClick={() => {
                    if (!isWalletMode) {
                      setConsultMode("wallet");
                    }
                  }}
                >
                  Wallet Connection
                </button>
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 transition ${
                    !isWalletMode
                      ? "bg-gradient-to-r from-emerald-400/70 via-indigo-500/70 to-purple-500/70 text-slate-900 shadow-lg shadow-indigo-500/30"
                      : "text-slate-300/70 hover:text-white"
                  }`}
                  role="radio"
                  aria-checked={!isWalletMode}
                  onClick={() => {
                    if (isWalletMode) {
                      setConsultMode("manual");
                    }
                  }}
                >
                  Manual Address
                </button>
              </div>

              {isWalletMode ? (
                <div className="flex flex-col gap-3 text-sm text-slate-300/80">
                  <span className="text-[11px] uppercase tracking-[0.28em] text-slate-300/60">
                    Solana Wallet
                  </span>
                  <div>
                    {hasMounted ? (
                      <WalletMultiButton className="w-full justify-center rounded-xl border border-white/5 bg-gradient-to-r from-emerald-400 via-indigo-500 to-purple-500 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-indigo-500/40 transition hover:-translate-y-0.5" />
                    ) : (
                      <button
                        type="button"
                        className="w-full cursor-wait rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm text-slate-300/60"
                        disabled
                      >
                        Connecting…
                      </button>
                    )}
                  </div>
                  {isWalletReady && publicKey ? (
                    <p className="text-xs text-slate-200/80">
                      Connected:&nbsp; <span className="font-mono text-white">{shortAddress}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-300/70">
                      Connect your wallet to start the automatic analysis.
                    </p>
                  )}
                </div>
              ) : (
                <label className="flex flex-col gap-3 text-sm text-slate-300/80">
                  <span className="text-[11px] uppercase tracking-[0.28em] text-slate-300/60">
                    Solana Wallet Address
                  </span>
                  <input
                    type="text"
                    placeholder="Ex: 9x6u… (base58)"
                    value={manualAddress}
                    onChange={(event) => setManualAddress(event.target.value)}
                    autoComplete="off"
                    required
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-white/40 focus:ring-4 focus:ring-indigo-500/20"
                  />
                  <p className="text-xs text-slate-300/70">
                    Paste a base58 address to start the analysis without connecting a wallet.
                  </p>
                </label>
              )}

              {!isWalletMode && (
                <button
                  type="submit"
                  disabled={!canFetch}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-gradient-to-r from-emerald-400 via-indigo-500 to-purple-500 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-indigo-500/40 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {viewStatus === "loading" ? "Analyzing..." : "Analyze"}
                </button>
              )}
            </motion.form>

            <motion.div
              className="rounded-2xl border border-white/10 bg-slate-950/60 p-6"
              initial={{ opacity: 0, x: 28 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, ease: "easeOut", delay: 0.12 }}
            >
              {viewStatus === "idle" && (
                <p className="text-sm text-slate-300/70">{idleMessage}</p>
              )}

              {viewStatus === "loading" && (
                <motion.p
                  key="loading"
                  className="text-sm text-slate-200/80"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Analyzing wallet…
                </motion.p>
              )}

              {viewStatus === "error" && (
                <motion.p
                  key="error"
                  className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {viewErrorMessage}
                </motion.p>
              )}

              {viewStatus === "success" && viewResult && (
                <motion.div
                  key={viewResult.walletAddress}
                  className="flex flex-col gap-5"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                >
                  <span className="text-xs uppercase tracking-[0.28em] text-slate-300/60">
                    Reclaimable SOL
                  </span>
                  <strong className="text-4xl font-semibold text-white">
                    {viewResult.reclaimableSOLFormatted} ◎
                  </strong>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                      <p className="text-[11px] uppercase tracking-[0.26em] text-slate-300/60">
                        Empty ATAs
                      </p>
                      <span className="mt-1 block text-xl text-white">{emptyAtasCount}</span>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                      <p className="text-[11px] uppercase tracking-[0.26em] text-slate-300/60">
                        Total ATAs
                      </p>
                      <span className="mt-1 block text-xl text-white">{totalAtasCount}</span>
                    </div>
                  </div>

                  {canReclaim ? (
                    <button
                      type="button"
                      onClick={() => {
                        void handleReclaim();
                      }}
                      disabled={reclaiming}
                      className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-gradient-to-r from-emerald-400 via-indigo-500 to-purple-500 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-indigo-500/40 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {reclaimButtonLabel}
                    </button>
                  ) : (
                    <p className="text-sm text-slate-300/70">
                      {emptyAtasCount === 0
                        ? "No empty ATAs to close."
                        : isWalletMode
                          ? "Connect the owner wallet to close these ATAs."
                          : "Switch to wallet mode to close your empty ATAs."}
                    </p>
                  )}

                  {reclaimError && (
                    <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                      {reclaimError}
                    </p>
                  )}

                  {reclaimSuccess && (
                    <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                      <p>{reclaimSuccess}</p>
                      {reclaimSignatures.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                          {reclaimSignatures.map((signature) => (
                            <li
                              key={signature}
                              className="rounded-md bg-emerald-500/10 px-2 py-1 font-mono text-emerald-100"
                            >
                              {signature.slice(0, 4)}…{signature.slice(-4)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {isWalletMode && ownedResult && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300/80">
                      {rewardState.status === "idle" && (
                        <p>
                          Pioneers receive a “Welcome Family” NFT after their first reclaim.
                        </p>
                      )}
                      {rewardState.status === "pending" && (
                        <p className="text-indigo-200">
                          Welcome Family NFT distribution in progress...
                        </p>
                      )}
                      {rewardState.status === "minted" && (
                        <div className="space-y-2 text-emerald-100">
                          <p>Congratulations, you are joining the Welcome Family!</p>
                          <div className="flex flex-wrap gap-3">
                            {rewardState.mintAddress && (
                              <a
                                href={`https://solscan.io/token/${rewardState.mintAddress}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-emerald-400/40 px-3 py-1"
                              >
                                View NFT
                              </a>
                            )}
                            {rewardState.signature && (
                              <a
                                href={`https://solscan.io/tx/${rewardState.signature}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-emerald-400/40 px-3 py-1"
                              >
                                View transaction
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                      {rewardState.status === "already" && (
                        <p>Your Welcome Family NFT is already in your wallet.</p>
                      )}
                      {rewardState.status === "error" && (
                        <p className="text-rose-200">{rewardState.message}</p>
                      )}
                    </div>
                  )}

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-slate-200/80">
                    <div className="flex justify-between text-[11px] uppercase tracking-[0.22em] text-slate-300/60">
                      <span>ATA</span>
                      <span>Mint</span>
                    </div>
                    {previewAccounts.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {previewAccounts.map((account) => (
                          <div
                            key={account.ataAddress}
                            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 rounded-lg bg-slate-900/60 px-3 py-2 font-mono text-[11px]"
                          >
                            <span className="truncate">{account.ataAddress}</span>
                            <span className="truncate text-right text-slate-300/70">
                              {account.mint}
                            </span>
                          </div>
                        ))}
                        {remainingAccounts > 0 && (
                          <p className="text-center text-[11px] text-slate-300/60">
                            + {remainingAccounts} other
                            {remainingAccounts > 1 ? "s" : ""} ATA
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-4 text-center text-sm text-slate-300/70">
                        {emptyAtasCount === 0
                          ? "No empty ATAs detected."
                          : "ATA list unavailable."}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        </motion.section>
      </main>

      <footer className="relative z-20 mx-auto mb-12 mt-10 flex w-full max-w-6xl flex-wrap items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/10 px-8 py-5 text-sm text-slate-300/80">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 via-indigo-500 to-purple-500 text-base font-semibold text-slate-900 shadow-lg shadow-indigo-500/40">
            ◎
          </span>
          <p>© {new Date().getFullYear()} ATA Protocol — Build the future, reclaim the rent.</p>
        </div>
        <div className="flex items-center gap-4">
          <a className="transition hover:text-white" href="#hero">
            Top of page
          </a>
          <a className="transition hover:text-white" href="#tokenomics">
            Tokenomics
          </a>
          <a className="transition hover:text-white" href="#consult">
            Consult a wallet
          </a>
        </div>
      </footer>
    </div>
  );
}
