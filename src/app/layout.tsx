import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "April Zhao Realty",
  description: "Your trusted real estate partner in the Bay Area",
};

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-zinc-100">
      <nav className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight">
          <span className="gradient-text">April Zhao</span>
        </Link>
        <div className="flex items-center gap-8">
          <div className="hidden sm:flex gap-8 text-sm font-medium">
            <Link href="/listings" className="text-zinc-600 hover:text-[#381b5e] transition-colors">
              Listings
            </Link>
            <Link href="/about" className="text-zinc-600 hover:text-[#381b5e] transition-colors">
              About
            </Link>
          </div>
          <Link
            href="/contact"
            className="px-5 py-2.5 bg-[#381b5e] text-white text-sm font-medium rounded-full hover:bg-[#4a2578] transition-all hover:shadow-lg hover:shadow-purple-500/25"
          >
            Contact
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-[#0a0a0a] text-white mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-12">
          <div>
            <h3 className="text-2xl font-bold mb-4">
              <span className="text-[#b1ff8f]">April Zhao</span>
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Helping families find their perfect home in the Bay Area with personalized service and local expertise.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-[#c181ff]">Quick Links</h4>
            <div className="space-y-2 text-sm text-zinc-400">
              <Link href="/listings" className="block hover:text-white transition-colors">Listings</Link>
              <Link href="/about" className="block hover:text-white transition-colors">About</Link>
              <Link href="/contact" className="block hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-[#c181ff]">Get in Touch</h4>
            <div className="space-y-2 text-sm text-zinc-400">
              <a href="mailto:aprilcasf@gmail.com" className="block hover:text-white transition-colors">
                aprilcasf@gmail.com
              </a>
              <p>San Jose, CA · BQ Realty</p>
            </div>
          </div>
        </div>
        <div className="border-t border-zinc-800 mt-12 pt-8 text-center text-sm text-zinc-500">
          <p>&copy; {new Date().getFullYear()} April Zhao Realty. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased min-h-screen flex flex-col`}>
        <Header />
        <main className="flex-1 pt-20">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
