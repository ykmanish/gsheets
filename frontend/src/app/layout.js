import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Smart Management System",
  description: "A smart management system for efficient operations and data-driven decision making.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className="newq"
    >
      <body className="min-h-full newq flex flex-col">{children}</body>
    </html>
  );
}
