import type { Metadata } from "next";
import "./globals.css";
import MobileRestriction from "@/components/MobileRestriction";

export const metadata: Metadata = {
  title: "KV",
  description: "Krishnavyshak",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MobileRestriction />
        {children}
      </body>
    </html>
  );
}
