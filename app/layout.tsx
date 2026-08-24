import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/lib/toast";
import { ToastViewport } from "@/components/Toast";
import { AmbientBackground } from "@/components/AmbientBackground";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ArcSwap",
  description: "Swap stablecoins on Arc Testnet",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ArcSwap",
  },
};

export const viewport: Viewport = {
  themeColor: "#171717",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AmbientBackground />
        <ToastProvider>
          {children}
          <ToastViewport />
        </ToastProvider>
      </body>
    </html>
  );
}
