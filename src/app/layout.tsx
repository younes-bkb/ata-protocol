import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import WalletProviders from "./providers/WalletProviders";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "$ATA Protocol — Reclaim the Rent",
  description:
    "Découvrez la vision de la crypto $ATA : tokenomics, roadmap et outil pour estimer le SOL récupérable sur vos Associated Token Accounts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={cn(
          "min-h-screen bg-background font-sans text-foreground antialiased",
          geistSans.variable,
          geistMono.variable,
        )}
      >
        <WalletProviders>
          <div className="relative flex min-h-screen flex-col">{children}</div>
        </WalletProviders>
      </body>
    </html>
  );
}
