import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Matchday Manager — FIFA World Cup 2026 Simulator",
  description: "AI-powered match simulation and tactical predictor for FIFA World Cup 2026. Configure lineups, tactics, and substitutions to predict match outcomes.",
  keywords: ["FIFA", "World Cup 2026", "match simulator", "tactical predictor", "football", "soccer"],
  authors: [{ name: "Z.ai Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Matchday Manager — FIFA World Cup 2026",
    description: "AI-powered match simulation and tactical predictor for FIFA World Cup 2026",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Matchday Manager — FIFA World Cup 2026",
    description: "AI-powered match simulation and tactical predictor for FIFA World Cup 2026",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
