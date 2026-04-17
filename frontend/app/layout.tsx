"use client";

import { useState } from "react";
import { Inter } from "next/font/google";

import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { Navbar } from "@/components/navbar";
import { AuthModal } from "@/components/auth-modal";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <title>AI Video Summarizer</title>
        <meta
          name="description"
          content="YouTube veya kayit dosyasindan transcript ve AI ozet uretir."
        />
      </head>
      <body className={inter.variable}>
        <ThemeProvider>
          <AuthProvider>
            <Navbar onLoginClick={() => setAuthOpen(true)} />
            <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
