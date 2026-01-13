import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Header, Footer, ScrollToTop } from "@/components/ClientLayout";
import { AgentStructuredData } from "@/components/StructuredData";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://aprilzhaohome.com"),
  title: {
    default: "April Zhao | Bay Area Real Estate Agent",
    template: "%s | April Zhao Realty",
  },
  description:
    "Your trusted real estate partner in the San Francisco Bay Area. Expert guidance for buying and selling homes in San Jose, San Mateo, Belmont, Redwood City, and surrounding areas. Over $57M in sales volume.",
  keywords: [
    "Bay Area real estate",
    "San Jose realtor",
    "San Mateo homes for sale",
    "Belmont real estate agent",
    "Redwood City houses",
    "San Carlos real estate",
    "Palo Alto homes",
    "Silicon Valley realtor",
    "buy home Bay Area",
    "sell home Bay Area",
    "April Zhao realtor",
    "BQ Realty",
  ],
  authors: [{ name: "April Zhao" }],
  creator: "April Zhao Realty",
  publisher: "April Zhao Realty",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://aprilzhaohome.com",
    siteName: "April Zhao Realty",
    title: "April Zhao | Bay Area Real Estate Agent",
    description:
      "Your trusted real estate partner in the San Francisco Bay Area. Expert guidance for buying and selling homes with over $57M in sales volume.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "April Zhao - Bay Area Real Estate Agent",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "April Zhao | Bay Area Real Estate Agent",
    description:
      "Your trusted real estate partner in the San Francisco Bay Area. Expert guidance for buying and selling homes.",
    images: ["/images/og-image.jpg"],
    creator: "@aprilzhaohome",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add your Google Search Console verification code here
    // google: "your-google-verification-code",
  },
  alternates: {
    canonical: "https://aprilzhaohome.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#d4a012" />
        <AgentStructuredData />
        <GoogleAnalytics />
      </head>
      <body
        className={`${inter.variable} ${playfair.variable} font-sans antialiased min-h-screen flex flex-col bg-white`}
      >
        <Header />
        <main className="flex-1 pt-20">{children}</main>
        <Footer />
        <ScrollToTop />
        <Analytics />
      </body>
    </html>
  );
}
