import type { Metadata, Viewport } from "next";
import { RegisterSW } from "@/components/RegisterSW";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bao Message",
  description: "A cozy little chat for friends.",
  applicationName: "Bao",
};

export const viewport: Viewport = {
  themeColor: "#FFF8F0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* Desktop shows a centered phone-width column; mobile is full-bleed. */}
        <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col bg-bao-cream sm:shadow-[0_0_24px_rgba(43,43,43,0.06)]">
          {children}
        </div>
        <RegisterSW />
      </body>
    </html>
  );
}
