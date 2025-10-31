import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, type Commitment } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

const DEFAULT_RPC_ENDPOINT =
  process.env.SOLANA_RPC_ENDPOINT ?? "https://api.mainnet-beta.solana.com";
const DEFAULT_COMMITMENT: Commitment = "confirmed";
const COMMITMENTS: Commitment[] = ["processed", "confirmed", "finalized"];
const RENT_EXEMPT_AMOUNT = 0.00203928; // SOL par ATA

type Payload = {
  walletAddress?: string;
  rpcEndpoint?: string;
  commitment?: Commitment;
};

export async function POST(request: NextRequest) {
  let payload: Payload;

  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json(
      {
        success: false,
        reason: "invalid_json",
        message: "Corps de requête JSON invalide.",
      },
      { status: 400 },
    );
  }

  const walletAddress = payload.walletAddress?.trim();
  const rpcEndpoint =
    payload.rpcEndpoint?.trim() === ""
      ? DEFAULT_RPC_ENDPOINT
      : payload.rpcEndpoint ?? DEFAULT_RPC_ENDPOINT;
  const commitment: Commitment =
    payload.commitment && COMMITMENTS.includes(payload.commitment)
      ? payload.commitment
      : DEFAULT_COMMITMENT;

  if (!walletAddress) {
    return NextResponse.json(
      {
        success: false,
        reason: "missing_wallet",
        message:
          "Adresse de wallet manquante. Fournissez une adresse base58 valide.",
      },
      { status: 400 },
    );
  }

  let ownerPublicKey: PublicKey;

  try {
    ownerPublicKey = new PublicKey(walletAddress);
  } catch {
    return NextResponse.json(
      {
        success: false,
        reason: "invalid_wallet",
        message: "Adresse de wallet invalide. Vérifiez le format base58.",
      },
      { status: 400 },
    );
  }

  try {
    const connection = new Connection(rpcEndpoint, commitment);

    type TokenAmountInfo = {
      amount: string;
      decimals: number;
      uiAmount: number | null;
      uiAmountString: string;
    };

    type ParsedAccountInfo = {
      mint: string;
      owner: string;
      state: string;
      isNative: boolean;
      tokenAmount: TokenAmountInfo;
    };

    const parsedAccounts = await connection.getParsedTokenAccountsByOwner(
      ownerPublicKey,
      { programId: TOKEN_PROGRAM_ID },
      commitment,
    );

    const ataEntries = await Promise.all(
      parsedAccounts.value.map(async (entry) => {
        const parsed = entry.account.data.parsed as
          | { info?: ParsedAccountInfo }
          | undefined;
        const info = parsed?.info;
        if (!info) {
          return null;
        }

        try {
          const derivedAta = await getAssociatedTokenAddress(
            new PublicKey(info.mint),
            ownerPublicKey,
            true,
          );
          if (!derivedAta.equals(entry.pubkey)) {
            return null;
          }
        } catch {
          return null;
        }

        return {
          ataAddress: entry.pubkey.toBase58(),
          mint: info.mint,
          amount: info.tokenAmount.amount,
          decimals: info.tokenAmount.decimals,
          uiAmount: info.tokenAmount.uiAmount,
          uiAmountString: info.tokenAmount.uiAmountString,
          state: info.state,
          isFrozen: info.state === "frozen",
        };
      }),
    );

    const associatedAccounts = ataEntries.filter(
      (value): value is NonNullable<typeof value> => value !== null,
    );

    // Calcul spécifique pour les ATA vides récupérables
    const emptyATAs = associatedAccounts.filter(
      (account) => account.amount === "0" && !account.isFrozen,
    );
    
    const reclaimableSOL = emptyATAs.length * RENT_EXEMPT_AMOUNT;

    return NextResponse.json(
      {
        success: true,
        walletAddress: ownerPublicKey.toBase58(),
        totalATAs: associatedAccounts.length,
        emptyATAs: emptyATAs.length,
        reclaimableSOL: reclaimableSOL,
        reclaimableSOLFormatted: reclaimableSOL.toFixed(6),
        rentPerATA: RENT_EXEMPT_AMOUNT,
        accounts: emptyATAs,
        allAccounts: associatedAccounts,
        commitment,
      },
      {},
    );
  } catch (error) {
    console.error("ATA rent lookup failed:", error);
    return NextResponse.json(
      {
        success: false,
        reason: "rpc_error",
        message:
          "Impossible de récupérer les informations auprès du RPC Solana.",
      },
      { status: 502 },
    );
  }
}