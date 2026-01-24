"use client";

import { Inter, Playfair_Display } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

export { inter, playfair };

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { href: "/listings", label: "Properties" },
    { href: "/testimonials", label: "Testimonials" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/98 backdrop-blur-sm border-b border-neutral-100 shadow-sm"
            : "bg-white/98 backdrop-blur-sm border-b border-neutral-100"
        }`}
      >
        <nav className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex flex-col group z-50">
            <div className={`${playfair.className} text-2xl font-normal tracking-wide text-neutral-900`}>
              <span className="text-[#d4a012]">April</span> Zhao
            </div>
            <span className="text-[10px] text-[#d4a012] tracking-[0.15em] uppercase">Expertise. Ethics. Excellence.</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.slice(0, 3).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium uppercase tracking-widest transition-colors relative ${
                  isActive(link.href)
                    ? "text-neutral-900"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {link.label}
                {isActive(link.href) && (
                  <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#d4a012]" />
                )}
              </Link>
            ))}
            <Link
              href="/contact"
              className={`px-6 py-3 border-2 text-xs font-medium uppercase tracking-widest transition-all duration-300 ${
                isActive("/contact")
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white"
              }`}
            >
              Contact
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden z-50 w-10 h-10 flex flex-col items-center justify-center gap-1.5"
            aria-label="Toggle menu"
          >
            <span
              className={`w-6 h-0.5 bg-neutral-900 transition-all duration-300 ${
                mobileMenuOpen ? "rotate-45 translate-y-2" : ""
              }`}
            />
            <span
              className={`w-6 h-0.5 bg-neutral-900 transition-all duration-300 ${
                mobileMenuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`w-6 h-0.5 bg-neutral-900 transition-all duration-300 ${
                mobileMenuOpen ? "-rotate-45 -translate-y-2" : ""
              }`}
            />
          </button>
        </nav>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-white transition-all duration-500 md:hidden ${
          mobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <nav className="flex flex-col items-center gap-8">
            {navLinks.map((link, index) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-2xl font-light uppercase tracking-widest transition-all duration-300 ${
                  isActive(link.href) ? "text-[#d4a012]" : "text-neutral-900 hover:text-[#d4a012]"
                }`}
                style={{
                  transitionDelay: mobileMenuOpen ? `${index * 100}ms` : "0ms",
                  transform: mobileMenuOpen ? "translateY(0)" : "translateY(20px)",
                  opacity: mobileMenuOpen ? 1 : 0,
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Contact Info in Mobile Menu */}
          <div
            className="mt-16 text-center"
            style={{
              transitionDelay: mobileMenuOpen ? "400ms" : "0ms",
              transform: mobileMenuOpen ? "translateY(0)" : "translateY(20px)",
              opacity: mobileMenuOpen ? 1 : 0,
              transition: "all 0.3s ease",
            }}
          >
            <p className="text-xs uppercase tracking-widest text-neutral-400 mb-3">Get in Touch</p>
            <a
              href="mailto:aprilcasf@gmail.com"
              className="text-neutral-900 hover:text-[#d4a012] transition-colors"
            >
              aprilcasf@gmail.com
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-neutral-900 text-white mt-auto">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand Column */}
          <div className="md:col-span-2">
            <div className={`${playfair.className} text-3xl font-normal mb-2`}>
              <span className="text-[#d4a012]">April</span> Zhao
            </div>
            <p className="text-[#d4a012] text-xs tracking-[0.2em] uppercase mb-6">Expertise. Ethics. Excellence.</p>
            <p className="text-neutral-400 text-sm leading-relaxed max-w-md mb-8">
              Helping families find their perfect home with personalized service, deep local expertise, and a commitment to excellence.
            </p>
            <div className="flex items-end gap-4 mb-8">
              <Image
                src="/bq-realty-logo.png"
                alt="BQ Realty"
                width={120}
                height={28}
                className="object-contain"
              />
              <span className="text-neutral-400 text-sm pb-1">CalBRE# 01929787</span>
            </div>

          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-widest text-[#d4a012] mb-8">Navigation</h4>
            <ul className="space-y-4">
              <li>
                <Link href="/" className="text-neutral-400 hover:text-white transition-colors text-sm uppercase tracking-wider">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/listings" className="text-neutral-400 hover:text-white transition-colors text-sm uppercase tracking-wider">
                  Transactions
                </Link>
              </li>
              <li>
                <Link href="/testimonials" className="text-neutral-400 hover:text-white transition-colors text-sm uppercase tracking-wider">
                  Testimonials
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-neutral-400 hover:text-white transition-colors text-sm uppercase tracking-wider">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-neutral-400 hover:text-white transition-colors text-sm uppercase tracking-wider">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-widest text-[#d4a012] mb-8">Get in Touch</h4>
            <ul className="space-y-4">
              <li>
                <a
                  href="mailto:aprilcasf@gmail.com"
                  className="text-neutral-400 hover:text-[#d4a012] transition-colors text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  aprilcasf@gmail.com
                </a>
              </li>
              <li>
                <a
                  href="tel:650-200-5221"
                  className="text-neutral-400 hover:text-[#d4a012] transition-colors text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                  650-200-5221
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">
            &copy; {currentYear} April Zhao Realty
          </p>
          <div className="flex items-center gap-6 text-xs text-neutral-500 uppercase tracking-wider">
            <span>California Real Estate License #02157957</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Scroll to Top Button Component
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-8 right-8 z-50 w-12 h-12 bg-neutral-900 text-white flex items-center justify-center transition-all duration-300 hover:bg-[#d4a012] shadow-lg ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      aria-label="Scroll to top"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18"/>
      </svg>
    </button>
  );
}
