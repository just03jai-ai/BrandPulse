import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "BrandPulse",
  description: "Employee Advocacy Intelligence Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className="bg-gray-950 text-white antialiased h-full">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
