import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Agentic Workbench · Research with evidence",
  description:
    "A research and decision workspace with cited synthesis, transparent tool activity, and context you control.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
