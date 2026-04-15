import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import PersistentLearn from "@/components/PersistentLearn";

export const metadata: Metadata = {
  title: "LeetLearn",
  description: "Spaced repetition for coding interviews",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning style={{
        paddingTop: 24,
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
        minHeight: "100vh",
      }}>
        {/* LearnPage lives here permanently — never unmounts, never re-fetches */}
        <PersistentLearn />

        {/* Other pages render as an overlay on top */}
        {children}

        <Nav />
      </body>
    </html>
  );
}
