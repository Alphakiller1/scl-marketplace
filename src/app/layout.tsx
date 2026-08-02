import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { appUrl } from "@/lib/app-url";
import { SCL_TITLE } from "@/lib/brand";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700"],
});

/** Ledger numerics — distinct from Barlow UI/display; strong tabular figures. */
const interData = Inter({
  variable: "--font-inter-data",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: SCL_TITLE,
    template: "%s · SCL",
  },
  description:
    "Inspect verified sports capper records, public picks, and transparent leaderboard history. SCL tracks inspectable records — it does not process payments or guarantee outcomes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${barlow.variable} ${barlowCondensed.variable} ${interData.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
