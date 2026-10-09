import type { Metadata } from "next";
import { Estedad, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const estedad = Estedad({
  variable: "--font-estedad",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Requester | Execution Console",
  description: "HTTP and browser request execution console.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={
        geistSans.variable +
        " " +
        geistMono.variable +
        " " +
        estedad.variable +
        " h-full antialiased"
      }
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
