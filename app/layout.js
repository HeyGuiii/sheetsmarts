import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "SheetSmarts",
  description: "Snap sheet music, hear it play, and practice with feedback!",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans bg-[#FFF8F0] text-[#1a1a2e]">
        {children}
      </body>
    </html>
  );
}
