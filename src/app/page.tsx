"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { createCloseAccountInstruction } from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";
import styles from "./page.module.css";

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
  { label: "Vision", href: "#vision" },
  { label: "Tokenomics", href: "#tokenomics" },
  { label: "Roadmap", href: "#roadmap" },
  { label: "Consultation", href: "#consult" },
];

const featureCards = [
  {
    title: "Liquidité instantanée",
    description:
      "Des pools ATA propulsés par Solana pour exécuter vos transactions en moins de 400 ms.",
  },
  {
    title: "Sécurité composable",
    description:
      "Des ATA auditables, compatibles avec toutes les dApps Solana et des garde-fous programmables.",
  },
  {
    title: "Gouvernance on-chain",
    description:
      "Chaque détenteur de $ATA influence les upgrades du protocole via des votes transparents.",
  },
];

const heroMetrics = [
  { label: "TPS cible", value: "65k+" },
  { label: "TVL objectif", value: "$1.2B" },
  { label: "Builders actifs", value: "350k+" },
];

const tokenomics = [
  {
    label: "Total supply",
    value: "1 000 000 000 $ATA",
    helper: "Emission fixe, aucun mint supplémentaire prévu.",
  },
  {
    label: "Circulating en TGE",
    value: "18%",
    helper: "Déblocage progressif sur 36 mois.",
  },
  {
    label: "Trésor Ecosystème",
    value: "24%",
    helper: "Programmes de grants & incentives pour les builders.",
  },
  {
    label: "Liquidité initiale",
    value: "25%",
    helper: "Pools SOL / USDC / $ATA dès le lancement.",
  },
];

const supplyBreakdown = [
  { label: "Communauté & airdrops", value: "20%" },
  { label: "Équipe & advisors", value: "12%" },
  { label: "Validateurs partenaires", value: "9%" },
  { label: "R&D Foundation", value: "10%" },
  { label: "Liquidité stratégique", value: "24%" },
  { label: "Réserves DAO", value: "5%" },
];

const roadmap = [
  {
    quarter: "Q1 2025",
    title: "Launch réseau principal",
    description:
      "Déploiement des smart-contracts ATA et ouverture des premiers pools de liquidité.",
  },
  {
    quarter: "Q2 2025",
    title: "Bridge multi-chaînes",
    description:
      "Connexion avec Ethereum, Base et BSC pour rendre les ATA interopérables.",
  },
  {
    quarter: "Q3 2025",
    title: "Governance DAO",
    description:
      "Activation du module de vote on-chain pour les décisions protocolaires.",
  },
  {
    quarter: "Q4 2025",
    title: "ATA Reclaim Suite",
    description:
      "Lancement de l'outil reclaim one-click avec automatisation des fermetures ATA.",
  },
];

const backgroundOrbs = [
  { style: { top: "-8%", left: "-12%" }, duration: 28 },
  { style: { top: "12%", right: "-14%" }, duration: 32 },
  { style: { bottom: "-16%", left: "24%" }, duration: 30 },
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
    ? "Connectez votre wallet pour découvrir le SOL récupérable."
    : "Saisissez une adresse Solana et lancez l'analyse.";
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
    ? "Reclaim en cours…"
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
        setStatus("error");
        setErrorMessage(
          "Renseignez une adresse de wallet Solana valide.",
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
              "Une erreur est survenue lors de la récupération des données.",
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
          "Impossible de contacter l'API. Vérifiez votre connexion réseau ou le RPC.",
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
            "Connectez votre wallet Solana pour lancer l'analyse.",
          );
          return;
        }
        void fetchAtaBalance(walletBase58);
        return;
      }

      if (!trimmedManualAddress) {
        setStatus("error");
        setErrorMessage(
          "Renseignez une adresse de wallet Solana valide.",
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
      setReclaimError("Connectez votre wallet Solana pour lancer le reclaim.");
      return;
    }

    if (!result || result.walletAddress !== walletBase58) {
      setReclaimError(
        "Les données affichées ne correspondent pas à votre wallet connecté.",
      );
      return;
    }

    if (!result.accounts.length) {
      setReclaimError("Aucun ATA vide à fermer.");
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
          ? `${collectedSignatures.length} transactions envoyées.`
          : "Transaction envoyée.";

      setReclaimSuccess(successMessage);
      setReclaimSignatures(collectedSignatures);

      await fetchAtaBalance(walletBase58);

      if (collectedSignatures.length === 0) {
        setRewardState({
          status: "error",
          message:
            "Signature de reclaim indisponible, mint du NFT de bienvenue annulé.",
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
                "Mint effectué mais informations manquantes. Vérifiez Supabase / explorer.",
            });
          }
        } else {
          setRewardState({
            status: "error",
            message:
              onboardingPayload?.message ??
              "Impossible de minter le NFT de bienvenue.",
          });
        }
      } catch (mintError) {
        console.error("Onboarding NFT mint failed", mintError);
        setRewardState({
          status: "error",
          message:
            "Mint du NFT de bienvenue inaccessible pour le moment. Réessayez plus tard.",
        });
      }
    } catch (error) {
      console.error(error);
      setReclaimError(
        "Impossible de finaliser le reclaim. Réessayez dans quelques instants.",
      );
      setRewardState({
        status: "error",
        message:
          "Le reclaim n'a pas abouti, le NFT de bienvenue n'a pas pu être attribué.",
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
    transition: { duration: 0.6, ease: "easeOut" },
  };

  return (
    <div className={styles.page}>
      <div className={styles.backdrop}>
        {backgroundOrbs.map((orb, index) => (
          <motion.span
            key={index}
            className={styles.orb}
            style={orb.style}
            initial={{ opacity: 0.25, scale: 0.92 }}
            animate={{ opacity: [0.25, 0.6, 0.25], scale: [0.88, 1.08, 0.88] }}
            transition={{
              duration: orb.duration,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <header className={styles.navbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>◎</span>
          <span className={styles.brandText}>ATA Protocol</span>
        </div>
        <nav className={styles.navLinks}>
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <a className={styles.navAction} href="#consult">
          Consulter un wallet
        </a>
      </header>

      <main className={styles.main}>
        <motion.section
          id="hero"
          className={styles.hero}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.75, ease: "easeOut" }}
        >
          <motion.span
            className={styles.heroBeam}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className={styles.heroContent}>
            <span className={styles.pill}>La naissance de $ATA</span>
            <h1>
              La crypto qui réinvente les Associated Token Accounts sur Solana.
            </h1>
            <p>
              $ATA propulse une expérience Solana plus rapide, plus fluide et
              plus communautaire. Conçu pour offrir une liquidité instantanée et
              une gouvernance pilotée par les builders.
            </p>
            <div className={styles.heroActions}>
              <a href="#tokenomics" className={styles.primaryAction}>
                Explorer la tokenomics
              </a>
              <a href="#consult" className={styles.secondaryAction}>
                Vérifier un wallet
              </a>
            </div>
            <div className={styles.heroStats}>
              {heroMetrics.map((metric) => (
                <motion.div
                  key={metric.label}
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ duration: 0.22 }}
                >
                  <span>{metric.value}</span>
                  <p>{metric.label}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className={styles.heroVisual}>
            <motion.span
              className={styles.heroHalo}
              animate={{ scale: [0.94, 1.06, 0.94], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.span
              className={styles.haloRing}
              animate={{ rotate: 360 }}
              transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className={styles.visualCard}
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
            >
              <div className={styles.visualGlow} />
              <motion.div
                className={styles.visualContent}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <p className={styles.visualLabel}>Mascotte officielle</p>
                <Image
                  src="/mascotteATA.png"
                  alt="Mascotte du token $ATA"
                  width={320}
                  height={320}
                  priority
                />
                <p className={styles.visualHelper}>
                  Palette inspirée du gradient SOL, pour une identité lumineuse
                  et futuriste.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </motion.section>

        <motion.section id="vision" className={styles.section} {...fadeUp}>
          <div className={styles.sectionHeading}>
            <span>Vision</span>
            <h2>Un protocole pensé pour la prochaine génération de builders.</h2>
            <p>
              La mission de $ATA est de simplifier la gestion des ATA tout en
              offrant des primitives de liquidité puissantes et auditées.
            </p>
          </div>
          <div className={styles.featuresGrid}>
            {featureCards.map((card) => (
              <motion.article
                key={card.title}
                className={styles.featureCard}
                whileHover={{ translateY: -8, scale: 1.02 }}
                transition={{ duration: 0.22 }}
              >
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section id="tokenomics" className={styles.section} {...fadeUp}>
          <div className={styles.sectionHeading}>
            <span>Tokenomics</span>
            <h2>Une distribution maîtrisée au service de la décentralisation.</h2>
            <p>
              Des allocations transparentes, un calendrier de vesting lisible et
              un trésor pensé pour durer. Toutes les données présentées sont
              fictives et servent de base à la future release.
            </p>
          </div>

          <div className={styles.tokenGrid}>
            {tokenomics.map((item) => (
              <motion.div
                key={item.label}
                className={styles.tokenCard}
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ duration: 0.22 }}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.helper}</p>
              </motion.div>
            ))}
          </div>

          <div className={styles.breakdown}>
            <h3>Répartition projetée</h3>
            <ul>
              {supplyBreakdown.map((item) => (
                <li key={item.label}>
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.section>

        <motion.section id="roadmap" className={styles.section} {...fadeUp}>
          <div className={styles.sectionHeading}>
            <span>Roadmap</span>
            <h2>Vers une suite ATA complète.</h2>
            <p>
              Une progression ambitieuse pour rendre les ATA intelligents,
              interopérables et entièrement automatisés.
            </p>
          </div>

          <div className={styles.roadmap}>
            {roadmap.map((item) => (
              <motion.article
                key={item.quarter}
                className={styles.roadmapItem}
                whileHover={{ translateY: -6, scale: 1.02 }}
                transition={{ duration: 0.22 }}
              >
                <span>{item.quarter}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section id="consult" className={styles.consult} {...fadeUp}>
          <div className={styles.consultIntro}>
            <span>Consultation ATA</span>
            <h2>
              Visualisez le SOL bloqué dans vos ATA, en un clin d&apos;œil.
            </h2>
            <p>
              Analysez un wallet Solana pour connaître le montant total de SOL
              récupérable. Toutes les valeurs affichées sont calculées côté
              serveur à partir de l&apos;endpoint RPC sélectionné.
            </p>
          </div>

          <div className={styles.consultPanel}>
            <motion.form
              className={styles.walletForm}
              onSubmit={handleSubmit}
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              <div
                className={styles.modeToggle}
                role="radiogroup"
                aria-label="Mode de consultation"
              >
                <button
                  type="button"
                  data-active={isWalletMode}
                  role="radio"
                  aria-checked={isWalletMode}
                  onClick={() => {
                    if (!isWalletMode) {
                      setConsultMode("wallet");
                    }
                  }}
                >
                  Connexion wallet
                </button>
                <button
                  type="button"
                  data-active={!isWalletMode}
                  role="radio"
                  aria-checked={!isWalletMode}
                  onClick={() => {
                    if (isWalletMode) {
                      setConsultMode("manual");
                    }
                  }}
                >
                  Adresse manuelle
                </button>
              </div>

              {isWalletMode ? (
                <div className={styles.field}>
                  <span>Wallet Solana</span>
                  <div className={styles.walletButton}>
                    {hasMounted ? (
                      <WalletMultiButton />
                    ) : (
                      <button type="button" className={styles.walletPlaceholder} disabled>
                        Connexion…
                      </button>
                    )}
                  </div>
                  {isWalletReady && publicKey ? (
                    <p className={styles.connectedWallet}>
                      Connecté&nbsp;: <span>{shortAddress}</span>
                    </p>
                  ) : (
                    <p className={styles.fieldHelper}>
                      Sélectionnez votre wallet pour lancer l&apos;analyse automatique.
                    </p>
                  )}
                </div>
              ) : (
                <label className={styles.field}>
                  <span>Adresse du wallet Solana</span>
                  <input
                    type="text"
                    placeholder="Ex : 9x6u… (base58)"
                    value={manualAddress}
                    onChange={(event) => setManualAddress(event.target.value)}
                    autoComplete="off"
                    required
                  />
                  <p className={styles.fieldHelper}>
                    Collez une adresse base58 pour lancer l’analyse sans connecter de wallet.
                  </p>
                </label>
              )}

              {!isWalletMode && (
                <button type="submit" disabled={!canFetch}>
                  {viewStatus === "loading" ? "Analyse en cours…" : "Analyser"}
                </button>
              )}
            </motion.form>

            <motion.div
              className={styles.resultPanel}
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, ease: "easeOut", delay: 0.1 }}
            >
              {viewStatus === "idle" && (
                <p className={styles.placeholder}>{idleMessage}</p>
              )}

              {viewStatus === "loading" && (
                <motion.p
                  key="loading"
                  className={styles.loading}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Analyse du wallet…
                </motion.p>
              )}

              {viewStatus === "error" && (
                <motion.p
                  key="error"
                  className={styles.error}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {viewErrorMessage}
                </motion.p>
              )}

              {viewStatus === "success" && viewResult && (
                <motion.div
                  key={viewResult.walletAddress}
                  className={styles.resultCard}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    boxShadow: [
                      "0 0 0 rgba(153, 69, 255, 0.35)",
                      "0 0 45px rgba(153, 69, 255, 0.5)",
                      "0 0 0 rgba(153, 69, 255, 0.35)",
                    ],
                  }}
                  transition={{
                    duration: 0.6,
                    ease: "easeOut",
                    boxShadow: { duration: 3.6, repeat: Infinity },
                  }}
                >
                  <span className={styles.resultLabel}>SOL récupérable</span>
                  <strong className={styles.resultValue}>
                    {viewResult.reclaimableSOLFormatted} ◎
                  </strong>
                  <div className={styles.resultStats}>
                    <div>
                      <p>ATAs vides</p>
                      <span>{emptyAtasCount}</span>
                    </div>
                    <div>
                      <p>Total ATAs</p>
                      <span>{totalAtasCount}</span>
                    </div>
                  </div>

                  {canReclaim ? (
                    <button
                      type="button"
                      className={styles.reclaimButton}
                      onClick={() => {
                        void handleReclaim();
                      }}
                      disabled={reclaiming}
                    >
                      {reclaimButtonLabel}
                    </button>
                  ) : (
                    <p className={styles.reclaimHint}>
                      {emptyAtasCount === 0
                        ? "Aucun ATA vide à fermer."
                        : isWalletMode
                          ? "Connectez le wallet propriétaire pour fermer ces ATAs."
                          : "Passez en mode wallet pour fermer vos ATAs vides."}
                    </p>
                  )}

                  {reclaimError && (
                    <p
                      className={`${styles.reclaimFeedback} ${styles.reclaimFeedbackError}`}
                    >
                      {reclaimError}
                    </p>
                  )}

                  {reclaimSuccess && (
                    <div
                      className={`${styles.reclaimFeedback} ${styles.reclaimFeedbackSuccess}`}
                    >
                      <p>{reclaimSuccess}</p>
                      {reclaimSignatures.length > 0 && (
                        <ul className={styles.reclaimSignatures}>
                          {reclaimSignatures.map((signature) => (
                            <li key={signature}>
                              {signature.slice(0, 4)}…{signature.slice(-4)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {isWalletMode && ownedResult && (
                    <div className={styles.rewardSection}>
                      {rewardState.status === "idle" && (
                        <p>
                          Les pionniers reçoivent un NFT &laquo;&nbsp;Welcome
                          Family Pioneer&nbsp;&raquo; après leur premier reclaim.
                        </p>
                      )}
                      {rewardState.status === "pending" && (
                        <p className={styles.rewardPending}>
                          Distribution du NFT de bienvenue en cours…
                        </p>
                      )}
                      {rewardState.status === "minted" && (
                        <div className={styles.rewardSuccess}>
                          <p>Félicitations, vous rejoignez la Welcome Family !</p>
                          <div className={styles.rewardLinks}>
                            {rewardState.mintAddress && (
                              <a
                                href={`https://solscan.io/token/${rewardState.mintAddress}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Voir le NFT
                              </a>
                            )}
                            {rewardState.signature && (
                              <a
                                href={`https://solscan.io/tx/${rewardState.signature}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Voir la transaction
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                      {rewardState.status === "already" && (
                        <div className={styles.rewardSuccess}>
                          <p>Votre NFT Welcome Family est déjà dans votre wallet.</p>
                          {rewardState.mintAddress && (
                            <div className={styles.rewardLinks}>
                              <a
                                href={`https://solscan.io/token/${rewardState.mintAddress}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Ouvrir sur Solscan
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                      {rewardState.status === "error" && (
                        <p className={styles.rewardError}>{rewardState.message}</p>
                      )}
                    </div>
                  )}

                  <div className={styles.ataList}>
                    <div className={styles.ataListHeading}>
                      <span>ATA</span>
                      <span>Mint</span>
                    </div>
                    {previewAccounts.length > 0 ? (
                      <>
                        <ul>
                          {previewAccounts.map((account) => (
                            <li key={account.ataAddress}>
                              <span>{account.ataAddress}</span>
                              <span>{account.mint}</span>
                            </li>
                          ))}
                        </ul>
                        {remainingAccounts > 0 && (
                          <p className={styles.ataListFoot}>
                            + {remainingAccounts} autre
                            {remainingAccounts > 1 ? "s" : ""} ATA
                          </p>
                        )}
                      </>
                    ) : (
                      <p className={styles.reclaimInfo}>
                        {emptyAtasCount === 0
                          ? "Aucun ATA vide détecté."
                          : "Liste d'ATAs indisponible."}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        </motion.section>
      </main>

      <footer className={styles.footer}>
        <div>
          <span className={styles.brandMark}>◎</span>
          <p>© {new Date().getFullYear()} ATA Protocol — Build the future, reclaim the rent.</p>
        </div>
        <div className={styles.footerLinks}>
          <a href="#hero">Haut de page</a>
          <a href="#tokenomics">Tokenomics</a>
          <a href="#consult">Consulter un wallet</a>
        </div>
      </footer>
    </div>
  );
}
