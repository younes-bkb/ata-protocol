#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");
const { Connection, Keypair } = require("@solana/web3.js");
const {
  Metaplex,
  keypairIdentity,
  toBigNumber,
} = require("@metaplex-foundation/js");

async function main() {
  const [, , keypairPath, metadataUri, rpcUrl] = process.argv;

  if (!keypairPath || !metadataUri) {
    console.error(
      "Usage: node scripts/create-collection.js <keypair.json> <metadata_uri> [rpc_url]",
    );
    process.exit(1);
  }

  const resolvedKeypairPath = path.resolve(keypairPath);
  const secretKey = JSON.parse(
    fs.readFileSync(resolvedKeypairPath, { encoding: "utf8" }),
  );
  const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  const endpoint =
    rpcUrl ??
    process.env.SOLANA_RPC_ENDPOINT ??
    "https://api.mainnet-beta.solana.com";
  const connection = new Connection(endpoint, "confirmed");
  const metaplex = Metaplex.make(connection).use(keypairIdentity(adminKeypair));

  const { mintAddress } = await metaplex.nfts().create({
    name: "Welcome Family Collection",
    symbol: "WFC",
    uri: metadataUri,
    sellerFeeBasisPoints: 0,
    isCollection: true,
    maxSupply: toBigNumber(0),
    updateAuthority: adminKeypair,
  });

  console.log("Collection mint:", mintAddress.toBase58());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
