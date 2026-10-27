import type { Metadata } from "next";
import "./globals.css";
import PushButton from "./push-button";

export const metadata: Metadata = {
  title: "Mayn Sales Point — Sell, Resell, Earn in Ghana",
  description: "Digital sales, reseller and affiliate platform for Ghana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-paper text-ink font-body antialiased">
        {children}
        <PushButton />
      </body>
    </html>
  );
}

// END OF FILE
