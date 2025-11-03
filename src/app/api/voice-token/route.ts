import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Metaplex, guestIdentity } from "@metaplex-foundation/js";
import nacl from "tweetnacl";
import { AccessToken } from "livekit-server-sdk";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COLLECTION_MINT = process.env.NFT_WELCOME_COLLECTION_MINT;
const RPC_ENDPOINT = process.env.SOLANA_RPC_ENDPOINT ?? "https://api.mainnet-beta.solana.com";

type VoiceTokenPayload = {
  walletAddress?: string;
  signature?: string;
  message?: string;
  room?: string;
};

function missingLivekitEnv() {
  return !LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET;
}

function createSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function walletOwnsNft(wallet: PublicKey): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return false;
  }

  const supabase = createSupabaseClient();
  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from("nft_mints")
    .select("status")
    .eq("user_wallet", wallet.toBase58())
    .eq("status", "success")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Supabase query failed", error);
    return false;
  }

  if (data) {
    return true;
  }

  // Fallback on-chain check if Supabase does not contain the wallet yet.
  if (!COLLECTION_MINT) {
    return false;
  }

  try {
    const collectionMint = new PublicKey(COLLECTION_MINT);
    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const metaplex = Metaplex.make(connection).use(guestIdentity());
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet, {
      programId: TOKEN_PROGRAM_ID,
    });

    for (const account of tokenAccounts.value) {
      const parsed = account.account.data.parsed as
        | { info?: { mint?: string; tokenAmount?: { uiAmount?: number } } }
        | undefined;
      const info = parsed?.info;
      const amount = info?.tokenAmount?.uiAmount ?? 0;
      if (!info?.mint || amount === 0) {
        continue;
      }

      const mint = new PublicKey(info.mint);

      try {
        const metadata = await metaplex.nfts().findByMint({ mintAddress: mint });
        if (metadata.collection?.verified && metadata.collection.address.toBase58() === collectionMint.toBase58()) {
          return true;
        }
      } catch {
        // ignore accounts without metadata
        continue;
      }
    }
  } catch (error) {
    console.error("On-chain NFT ownership check failed", error);
  }

  return false;
}

export async function POST(request: NextRequest) {
  if (missingLivekitEnv()) {
    return NextResponse.json(
      {
        success: false,
        reason: "livekit_not_configured",
        message: "LiveKit configuration missing on server side.",
      },
      { status: 500 },
    );
  }

  let payload: VoiceTokenPayload;
  try {
    payload = (await request.json()) as VoiceTokenPayload;
  } catch {
    return NextResponse.json(
      {
        success: false,
        reason: "invalid_json",
        message: "Invalid JSON request body.",
      },
      { status: 400 },
    );
  }

  const walletAddress = payload.walletAddress?.trim();
  const signature = payload.signature?.trim();
  const message = payload.message ?? "";
  const room = payload.room?.trim() || "welcome-family";

  if (!walletAddress || !signature || !message) {
    return NextResponse.json(
      {
        success: false,
        reason: "missing_parameters",
        message: "Address, signature and message are required.",
      },
      { status: 400 },
    );
  }

  let walletPublicKey: PublicKey;
  try {
    walletPublicKey = new PublicKey(walletAddress);
  } catch {
    return NextResponse.json(
      {
        success: false,
        reason: "invalid_wallet",
        message: "Invalid wallet address.",
      },
      { status: 400 },
    );
  }

  // Verify message prefix to avoid arbitrary signatures.
  if (!message.startsWith("ATA_VOICE_JOIN:")) {
    return NextResponse.json(
      {
        success: false,
        reason: "invalid_message",
        message: "Invalid signature message.",
      },
      { status: 400 },
    );
  }

  try {
    const signatureBytes = Buffer.from(signature, "base64");
    const messageBytes = new TextEncoder().encode(message);
    const publicKeyBytes = walletPublicKey.toBytes();

    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          reason: "invalid_signature",
          message: "Invalid signature.",
        },
        { status: 401 },
      );
    }
  } catch (error) {
    console.error("Signature verification failed", error);
    return NextResponse.json(
      {
        success: false,
        reason: "signature_error",
        message: "Could not verify signature.",
      },
      { status: 500 },
    );
  }

  const ownsNft = await walletOwnsNft(walletPublicKey);
  if (!ownsNft) {
    return NextResponse.json(
      {
        success: false,
        reason: "missing_nft",
        message: "Welcome Family NFT required to access the room.",
      },
      { status: 403 },
    );
  }

  try {
    const accessToken = new AccessToken(LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!, {
      identity: walletPublicKey.toBase58(),
      ttl: 60 * 10, // 10 minutes
    });

    accessToken.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await accessToken.toJwt();

    return NextResponse.json(
      {
        success: true,
        token,
        url: LIVEKIT_URL,
        room,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("LiveKit token generation failed", error);
    return NextResponse.json(
      {
        success: false,
        reason: "livekit_error",
        message: "Could not generate access token.",
      },
      { status: 500 },
    );
  }
}
