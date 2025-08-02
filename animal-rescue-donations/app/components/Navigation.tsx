
"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownLink, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Address, Avatar, Name, Identity, EthBalance } from "@coinbase/onchainkit/identity";

export default function Navigation() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const navItems = [
    { href: "/", label: "Home", icon: "🏠" },
    { href: "/adopt", label: "Adopt", icon: "🐕" },
    { href: "/raffle", label: "Raffle", icon: "🎟️" },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:block bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <a href="/" className="block">
                <img
                  src="/logos/barkbase-logo.png"
                  alt="BarkBase Logo"
                  className="h-12 w-auto"
                />
              </a>
            </div>

            {/* Desktop Navigation */}
            <div className="flex items-center space-x-8">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(item.href)
                      ? "bg-blue-100 text-blue-700 shadow-sm"
                      : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                  {isActive(item.href) && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full ml-1"></div>
                  )}
                </a>
              ))}
            </div>

            {/* Desktop Wallet */}
            <div>
              <Wallet>
                <ConnectWallet>
                  <Avatar className="h-6 w-6" />
                  <Name />
                </ConnectWallet>
                <WalletDropdown>
                  <Identity className="px-4 pt-3 pb-2">
                    <Avatar />
                    <Name />
                    <Address />
                    <EthBalance />
                  </Identity>
                  <WalletDropdownLink icon="wallet" href="https://keys.coinbase.com">
                    Wallet
                  </WalletDropdownLink>
                  <WalletDropdownDisconnect />
                </WalletDropdown>
              </Wallet>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        {/* Mobile Header - Floating over content */}
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-r from-white/95 to-blue-50/95 backdrop-blur-md">
          {/* Logo */}
          <div className="flex-shrink-0">
            <a href="/" className="block">
              <img
                src="/logos/barkbase-logo.png"
                alt="BarkBase Logo"
                className="h-14 w-auto"
              />
            </a>
          </div>

          {/* BARKBASE Text */}
          <div className="flex-1 flex justify-center">
            <h1 className="text-3xl font-bold text-blue-700 tracking-wide">
              BARKBASE
            </h1>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={toggleMobileMenu}
            className="p-3 rounded-xl bg-white/90 text-gray-700 hover:text-blue-600 hover:bg-white shadow-lg transition-all duration-200"
            aria-label="Toggle mobile menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={toggleMobileMenu}
            />
            
            {/* Menu Panel */}
            <div className="absolute top-20 left-4 right-4 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
              <div className="p-4 space-y-2">
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-4 px-4 py-4 rounded-xl text-base font-medium transition-all duration-200 ${
                      isActive(item.href)
                        ? "bg-blue-100 text-blue-700 shadow-sm"
                        : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {isActive(item.href) && (
                      <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                    )}
                  </a>
                ))}
                
                {/* Mobile Wallet */}
                <div className="pt-4 border-t border-gray-200 mt-4">
                  <Wallet>
                    <ConnectWallet>
                      <Avatar className="h-6 w-6" />
                      <Name />
                    </ConnectWallet>
                    <WalletDropdown>
                      <Identity className="px-4 pt-3 pb-2">
                        <Avatar />
                        <Name />
                        <Address />
                        <EthBalance />
                      </Identity>
                      <WalletDropdownLink icon="wallet" href="https://keys.coinbase.com">
                        Wallet
                      </WalletDropdownLink>
                      <WalletDropdownDisconnect />
                    </WalletDropdown>
                  </Wallet>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile content spacer */}
        <div className="h-20" />
      </div>
    </>
  );
}
