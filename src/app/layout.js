import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "AuraStream — Live Wedding Photo Sharing",
  description:
    "A luxury SaaS platform for photographers to stream real-time wedding photos to guests via QR code. Powered by Supabase Realtime.",
  keywords: [
    "wedding photos",
    "live photo stream",
    "wedding photography",
    "QR code gallery",
    "real-time sharing",
  ],
  openGraph: {
    title: "AuraStream — Live Wedding Photo Sharing",
    description:
      "Stream beautiful wedding moments to guests in real-time. Simply scan a QR code.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[--color-background] text-[--color-foreground]">
        {children}
      </body>
    </html>
  );
}
