import type { Metadata } from "next";
import "./globals.css";
import { SWRProvider } from "@/components/providers/swr-provider";

export const metadata: Metadata = {
  title: "Intelligence Platform",
  description: "Evidence-backed AI intelligence for builders.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><SWRProvider>{children}</SWRProvider></body></html>;
}
