import React from "react";
import { Menu, X, User, Bell, Coins } from "lucide-react";

interface PremiumHeaderProps {
  user: any;
  coins: number;
  onAuthClick: () => void;
  onProfileClick: () => void;
  onNotificationsClick: () => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
}

export const PremiumHeader: React.FC<PremiumHeaderProps> = ({
  user,
  coins,
  onAuthClick,
  onProfileClick,
  onNotificationsClick,
  isMenuOpen,
  setIsMenuOpen,
}) => {
  return (
    <header className="fixed top-0 inset-x-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto">
        <nav className="glass-card-aurora px-6 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="size-10 rounded-xl bg-gradient-aurora flex items-center justify-center shadow-aurora group-hover:scale-110 transition-transform duration-500">
              <span className="text-void font-bold text-xl">C</span>
            </div>
            <span className="text-xl font-bold tracking-tighter text-gradient-white">
              CRINAVA
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {["Oracle", "Matches", "Strategy", "Community"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-sm font-medium text-white/60 hover:text-aurora transition-colors duration-300"
              >
                {item}
              </a>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-imperial/10 border border-imperial/20">
                  <Coins className="size-4 text-imperial" />
                  <span className="text-sm font-bold text-imperial">
                    {coins}
                  </span>
                </div>
                <button
                  onClick={onNotificationsClick}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-aurora/40 hover:bg-white/10 transition-all duration-300 relative"
                >
                  <Bell className="size-5 text-white/80" />
                  <span className="absolute top-2 right-2 size-2 bg-aurora rounded-full border-2 border-void"></span>
                </button>
                <button
                  onClick={onProfileClick}
                  className="p-2.5 rounded-xl bg-gradient-aurora text-void hover:shadow-aurora transition-all duration-300"
                >
                  <User className="size-5" />
                </button>
              </>
            ) : (
              <button onClick={onAuthClick} className="btn-primary py-2.5 px-6">
                Get Started
              </button>
            )}

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2.5 rounded-xl bg-white/5 border border-white/10"
            >
              {isMenuOpen ? (
                <X className="size-5" />
              ) : (
                <Menu className="size-5" />
              )}
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
};
