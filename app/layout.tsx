import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KanbanFan",
  description: "Kanban board with AI correction and multi-format export",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
