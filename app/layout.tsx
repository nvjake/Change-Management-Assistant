import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chewy Change Activation Assistant",
  description: "A local, rule-based prototype for creating right-sized change activation plans.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Script src="/vendor/jszip.min.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
