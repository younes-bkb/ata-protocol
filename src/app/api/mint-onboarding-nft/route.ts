import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionSignature,
} from "@solana/web3.js";
import bs58 from "bs58";
import { Metaplex, keypairIdentity, toBigNumber } from "@metaplex-foundation/js";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_RPC_ENDPOINT =
  process.env.SOLANA_RPC_ENDPOINT ?? "https://api.mainnet-beta.solana.com";
const ADMIN_WALLET_SECRET_KEY = process.env.ADMIN_WALLET_SECRET_KEY;
const NFT_METADATA_URI = process.env.NFT_WELCOME_METADATA_URI;
const COLLECTION_MINT_ADDRESS = process.env.NFT_WELCOME_COLLECTION_MINT;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NAME = "Welcome Family Pioneer";
const SYMBOL = "WFP";
const SELLER_FEE_BASIS_POINTS = 0;

type MintRequestPayload = {
  walletAddress?: string;
  reclaimSignature?: string;
};

type SupabaseMintRow = {
  id: string;
  user_wallet: string;
  nft_mint_address: string | null;
  transaction_signature: string | null;
  reclaim_signature?: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

function createSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function loadAdminKeypair(): Keypair {
  if (!ADMIN_WALLET_SECRET_KEY) {
    throw new Error("ADMIN_WALLET_SECRET_KEY env variable is missing.");
  }

  try {
    const parsed = JSON.parse(ADMIN_WALLET_SECRET_KEY) as number[];
    if (Array.isArray(parsed)) {
      return Keypair.fromSecretKey(new Uint8Array(parsed));
    }
  } catch {
    // not JSON, fallback to base58
  }

  try {
    const secretKey = bs58.decode(ADMIN_WALLET_SECRET_KEY);
    return Keypair.fromSecretKey(secretKey);
  } catch {
    throw new Error("Unable to decode ADMIN_WALLET_SECRET_KEY.");
  }
}

type DuplicateCheckResult =
  | {
      alreadyMinted: true;
      recordId: string | null;
      latest: SupabaseMintRow;
    }
  | {
      alreadyMinted: false;
      recordId: string | null;
      latest?: undefined;
    };

async function ensureNoDuplicateMint(
  supabase: SupabaseClient | null,
  wallet: string,
  reclaimSignature?: string,
): Promise<DuplicateCheckResult> {
  if (!supabase) {
    return { alreadyMinted: false, recordId: null };
  }

  const { data, error } = await supabase
    .from("nft_mints")
    .select("*")
    .eq("user_wallet", wallet)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase lookup failed: ${error.message}`);
  }

  if (data && data.status === "success") {
    return { alreadyMinted: true, recordId: data.id, latest: data };
  }

  const insertPayload: Record<string, unknown> = {
    user_wallet: wallet,
    status: "pending",
  };

  if (reclaimSignature) {
    insertPayload.reclaim_signature = reclaimSignature;
  }

  const { data: pending, error: insertError } = await supabase
    .from("nft_mints")
    .insert([insertPayload])
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Supabase insert failed: ${insertError.message}`);
  }

  return { alreadyMinted: false, recordId: pending.id };
}

async function updateSupabaseStatus(
  supabase: SupabaseClient | null,
  recordId: string | null,
  updates: Partial<Omit<SupabaseMintRow, "id" | "user_wallet" | "created_at">>,
) {
  if (!supabase || !recordId) {
    return;
  }

  const { error } = await supabase
    .from("nft_mints")
    .update(updates)
    .eq("id", recordId);

  if (error) {
    console.error("Supabase update failed", error);
  }
}

async function fetchTransactionOwner(
  connection: Connection,
  signature: string,
): Promise<string | null> {
  try {
    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx?.transaction) {
      return null;
    }
    const feePayer = tx.transaction.message.getAccountKeys().get(0);
    return feePayer?.toBase58() ?? null;
  } catch (error) {
    console.error("Failed to fetch reclaim transaction", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!NFT_METADATA_URI || !COLLECTION_MINT_ADDRESS) {
    return NextResponse.json(
      {
        success: false,
        reason: "missing_env",
        message:
          "The NFT_WELCOME_METADATA_URI and NFT_WELCOME_COLLECTION_MINT environment variables are required.",
      },
      { status: 500 },
    );
  }

  let payload: MintRequestPayload;
  try {
    payload = (await request.json()) as MintRequestPayload;
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
  const reclaimSignature = payload.reclaimSignature?.trim();

  if (!walletAddress) {
    return NextResponse.json(
      {
        success: false,
        reason: "missing_wallet",
        message: "Missing wallet address.",
      },
      { status: 400 },
    );
  }

  if (!reclaimSignature) {
    return NextResponse.json(
      {
        success: false,
        reason: "missing_signature",
        message:
          "The reclaim transaction signature is required to validate eligibility.",
      },
      { status: 400 },
    );
  }

  let userPublicKey: PublicKey;
  try {
    userPublicKey = new PublicKey(walletAddress);
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

  const connection = new Connection(DEFAULT_RPC_ENDPOINT, "confirmed");
  const adminKeypair = loadAdminKeypair();
  const supabase = createSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      {
        success: false,
        reason: "supabase_not_configured",
        message:
          "The Supabase database is not configured on the server side. Please provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 },
    );
  }

  try {
    const feePayer = await fetchTransactionOwner(connection, reclaimSignature);
    if (feePayer !== walletAddress) {
      return NextResponse.json(
        {
          success: false,
          reason: "invalid_reclaim_signature",
        message:
          "The provided signature does not match the indicated wallet or is not confirmed.",
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Failed verifying reclaim signature", error);
    return NextResponse.json(
      {
        success: false,
        reason: "reclaim_verification_failed",
        message:
          "Could not verify the reclaim signature. Please try again later.",
      },
      { status: 502 },
    );
  }

  let pendingRecordId: string | null = null;

  try {
    const collectionMint = new PublicKey(COLLECTION_MINT_ADDRESS);
    const metaplex = Metaplex.make(connection).use(
      keypairIdentity(adminKeypair),
    );

    const duplicateCheck = await ensureNoDuplicateMint(
      supabase,
      walletAddress,
      reclaimSignature,
    );
    if (duplicateCheck.alreadyMinted) {
      return NextResponse.json(
        {
          success: true,
          status: "already_minted",
          message:
            "This wallet has already received the Welcome Family NFT. Thank you for your loyalty!",
          mintAddress: duplicateCheck.latest?.nft_mint_address ?? null,
        },
        { status: 200 },
      );
    }

    pendingRecordId = duplicateCheck.recordId;

    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`Admin wallet balance: ${balance} lamports`);

    const mintKeypair = Keypair.generate();

    const { response, mintAddress } = await metaplex.nfts().create(
      {
        uri: NFT_METADATA_URI,
        name: NAME,
        symbol: SYMBOL,
        sellerFeeBasisPoints: SELLER_FEE_BASIS_POINTS,
        useNewMint: mintKeypair,
        tokenOwner: userPublicKey,
        updateAuthority: adminKeypair,
        collection: collectionMint,
        collectionAuthority: adminKeypair,
        isMutable: false,
        maxSupply: toBigNumber(0),
      },
      { commitment: "confirmed" },
    );

    const signature: TransactionSignature = response.signature;

    await updateSupabaseStatus(supabase, pendingRecordId, {
      status: "success",
      nft_mint_address: mintAddress.toBase58(),
      transaction_signature: signature,
      error_message: null,
    });

    return NextResponse.json(
      {
        success: true,
        status: "minted",
        message: "Welcome Family NFT successfully awarded. Welcome!",
        mintAddress: mintAddress.toBase58(),
        signature,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("NFT mint failed", error);
    await updateSupabaseStatus(supabase, pendingRecordId, {
      status: "failed",
      error_message:
        error instanceof Error
          ? error.message
          : "Mint failed with an unknown error.",
    });
    return NextResponse.json(
      {
        success: false,
        reason: "mint_failed",
        message:
          error instanceof Error
            ? error.message
            : "Could not mint the NFT. Please try again later.",
      },
      { status: 500 },
    );
  }
}
