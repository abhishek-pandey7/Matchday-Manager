import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Matchday Manager — FIFA World Cup 2026 Simulator",
  description:
    "AI-powered match simulation and tactical predictor for FIFA World Cup 2026. Configure lineups, tactics, and substitutions to predict match outcomes.",
  keywords: [
    "FIFA",
    "World Cup 2026",
    "match simulator",
    "tactical predictor",
    "football",
    "soccer",
  ],
  authors: [{ name: "Matchday Manager" }],
  openGraph: {
    title: "Matchday Manager — FIFA World Cup 2026",
    description:
      "AI-powered match simulation and tactical predictor for FIFA World Cup 2026",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Matchday Manager — FIFA World Cup 2026",
    description:
      "AI-powered match simulation and tactical predictor for FIFA World Cup 2026",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
      >
        {/* Subtle noise texture overlay */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            opacity: 0.035,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "128px 128px",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  );
}
