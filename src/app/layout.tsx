import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BeManager — Foundation",
  description: "BeManager: esqueleto de arquitectura en fase Foundation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
