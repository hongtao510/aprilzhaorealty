import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "April Zhao | Bay Area Real Estate Agent",
  description: "Your trusted real estate partner in the San Francisco Bay Area. Expert guidance for buying and selling homes in San Jose, San Mateo, and surrounding areas.",
};

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-100/80">
      <nav className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-gradient-to-br from-[#381b5e] to-[#5e74ff] rounded-xl flex items-center justify-center text-white font-bold text-sm">
            AZ
          </div>
          <div className="hidden sm:block">
            <span className="text-lg font-bold text-zinc-900 group-hover:text-[#381b5e] transition-colors">April Zhao</span>
            <span className="hidden md:block text-xs text-zinc-500">Bay Area Real Estate</span>
          </div>
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-2 sm:gap-6">
          <div className="hidden sm:flex items-center gap-1">
            <Link
              href="/listings"
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-[#381b5e] hover:bg-[#381b5e]/5 rounded-lg transition-all"
            >
              Listings
            </Link>
            <Link
              href="/about"
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-[#381b5e] hover:bg-[#381b5e]/5 rounded-lg transition-all"
            >
              About
            </Link>
          </div>
          <Link
            href="/contact"
            className="px-5 py-2.5 bg-[#381b5e] text-white text-sm font-semibold rounded-xl hover:bg-[#4a2578] transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 hover:-translate-y-0.5"
          >
            Contact
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-zinc-900 text-white mt-auto">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand Column */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-[#c181ff] to-[#5e74ff] rounded-xl flex items-center justify-center text-white font-bold">
                AZ
              </div>
              <div>
                <h3 className="text-xl font-bold">April Zhao</h3>
                <p className="text-sm text-zinc-400">Real Estate Agent</p>
              </div>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-md mb-6">
              Helping families find their perfect home in the San Francisco Bay Area with personalized service, deep local expertise, and a commitment to excellence.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="px-3 py-1 bg-[#381b5e] rounded-full text-xs font-medium">BQ Realty</span>
              <span className="text-zinc-500">|</span>
              <span className="text-zinc-400">San Jose, CA</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-5 text-sm uppercase tracking-wider text-zinc-300">Quick Links</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-zinc-400 hover:text-white transition-colors text-sm flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-[#b1ff8f] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  Home
                </Link>
              </li>
              <li>
                <Link href="/listings" className="text-zinc-400 hover:text-white transition-colors text-sm flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-[#b1ff8f] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  Listings
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-zinc-400 hover:text-white transition-colors text-sm flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-[#b1ff8f] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-zinc-400 hover:text-white transition-colors text-sm flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-[#b1ff8f] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-semibold mb-5 text-sm uppercase tracking-wider text-zinc-300">Get in Touch</h4>
            <ul className="space-y-4">
              <li>
                <a
                  href="mailto:aprilcasf@gmail.com"
                  className="text-zinc-400 hover:text-[#b1ff8f] transition-colors text-sm flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  aprilcasf@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-3 text-zinc-400 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                San Francisco Bay Area
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-zinc-500">
            &copy; {currentYear} April Zhao Realty. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-zinc-500">
            <span>DRE License #XXXXXXX</span>
          </div>
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
      <body className={`${inter.variable} font-sans antialiased min-h-screen flex flex-col bg-white`}>
        <Header />
        <main className="flex-1 pt-20">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
