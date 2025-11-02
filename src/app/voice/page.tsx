"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import styles from "./page.module.css";
import "@livekit/components-styles";
import {
  LiveKitRoom,
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  Chat,
  useTracks,
  LayoutContextProvider,
} from "@livekit/components-react";
import { Track } from "livekit-client";

const DEFAULT_ROOM = "welcome-family";

export default function VoicePage() {
  const { publicKey, connected, signMessage } = useWallet();
  const [roomName, setRoomName] = useState(DEFAULT_ROOM);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  const walletAddress = useMemo(() => publicKey?.toBase58() ?? null, [publicKey]);
  const canJoin = connected && !!walletAddress && !!signMessage;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleJoin = useCallback(async () => {
    if (!walletAddress || !signMessage) {
      setError("Connectez un wallet compatible et autorisez la signature.");
      return;
    }

    const nonce = Date.now().toString();
    const message = `ATA_VOICE_JOIN:${roomName}:${nonce}`;

    try {
      setJoining(true);
      setError(null);

      const signatureBytes = await signMessage(new TextEncoder().encode(message));
      const signatureBase64 = btoa(String.fromCharCode(...signatureBytes));

      const response = await fetch("/api/voice-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          signature: signatureBase64,
          message,
          room: roomName,
        }),
      });

      const payload = await response.json();

      if (!response.ok || payload.success !== true) {
        setError(payload?.message ?? "Accès refusé au salon vocal.");
        return;
      }

      setToken(payload.token as string);
      setServerUrl(payload.url as string);
    } catch (joinError) {
      console.error(joinError);
      setError("Impossible de rejoindre le salon. Réessayez.");
    } finally {
      setJoining(false);
    }
  }, [walletAddress, signMessage, roomName]);

  const handleLeave = useCallback(() => {
    setToken(null);
    setServerUrl(null);
  }, []);

  return (
    <div className={styles.page}>
      {!token || !serverUrl ? (
        <div className={styles.card}>
          <h1>Salon vocal — Welcome Family</h1>
          <p className={styles.hint}>
            Rejoignez la room vocale réservée aux détenteurs du NFT « Welcome Family Pioneer ».
          </p>

          <div className={styles.field}>
            <span>Wallet connecté</span>
            {hasMounted ? (
              <WalletMultiButton />
            ) : (
              <button type="button" className={styles.walletPlaceholder} disabled>
                Connexion…
              </button>
            )}
            {!connected && (
              <p className={styles.hint}>Connectez votre wallet Solana pour continuer.</p>
            )}
          </div>

          <div className={styles.field}>
            <span>Room</span>
            <input
              type="text"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              onClick={handleJoin}
              disabled={!canJoin || joining}
            >
              {joining ? "Connexion..." : "Rejoindre le salon"}
            </button>
            <p className={styles.hint}>
              Une signature vous sera demandée pour vérifier la possession du NFT.
            </p>
            {error && <p className={styles.error}>{error}</p>}
          </div>
        </div>
      ) : (
        <div className={styles.roomContainer}>
          <LiveKitRoom
            serverUrl={serverUrl}
            token={token}
            data-lk-theme="default"
            onDisconnected={handleLeave}
            connectOptions={{ audio: true, video: false }}
            video={false}
          >
            <RoomAudioRenderer />
            <AudioOnlyConference />
          </LiveKitRoom>
        </div>
      )}
    </div>
  );
}

function AudioOnlyConference() {
  const tracks = useTracks(
    [{ source: Track.Source.Microphone, withPlaceholder: true }],
    { onlySubscribed: false },
  );

  return (
    <LayoutContextProvider>
      <div className={styles.voiceWrapper}>
        <div className={styles.participantArea}>
          <GridLayout tracks={tracks}>
            {(trackRef) => <ParticipantTile trackRef={trackRef} displayName position="bottom" />}
          </GridLayout>
        </div>
        <div className={styles.chatPanel}>
          <Chat />
        </div>
        <ControlBar
          controls={{
            microphone: true,
            camera: false,
            screenShare: true,
            chat: true,
            leave: true,
            fullscreen: false,
            participants: false,
            roomSettings: false,
          }}
        />
      </div>
    </LayoutContextProvider>
  );
}
