import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowRight, User, Bell, Coins } from "lucide-react";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  coins: number;
  onAuthClick: () => void;
  onProfileClick: () => void;
  onNotificationsClick: () => void;
}

/**
 * Renders a full-screen animated mobile navigation overlay with user info, navigation links, and contextual action buttons.
 * @example
 * MobileNav({ isOpen: true, onClose: () => {}, user: { email: "demo@example.com" }, coins: 120, onAuthClick: () => {}, onProfileClick: () => {}, onNotificationsClick: () => {} })
 * <MobileNav />
 * @param {boolean} isOpen - Controls whether the mobile navigation panel is visible.
 * @param {Function} onClose - Callback invoked to close the mobile navigation panel.
 * @param {Object|null} user - Authenticated user object used to display profile information, or null when signed out.
 * @param {number} coins - The current coin balance displayed in the user section.
 * @param {Function} onAuthClick - Callback invoked when the unauthenticated "Get Started" action is clicked.
 * @param {Function} onProfileClick - Callback invoked when the authenticated "View Profile" action is clicked.
 * @param {Function} onNotificationsClick - Callback invoked when the notifications button is clicked.
 * @returns {JSX.Element} The mobile navigation overlay component.
 **/
export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  user,
  coins,
  onAuthClick,
  onProfileClick,
  onNotificationsClick,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: "100%" }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[100] bg-void/95 backdrop-blur-heavy p-8 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-aurora flex items-center justify-center shadow-aurora">
                <span className="text-void font-bold text-xl">C</span>
              </div>
              <span className="text-xl font-bold tracking-tighter text-gradient-white">
                CRINAVA
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-3 rounded-xl bg-white/5 border border-white/10"
            >
              <X className="size-6" />
            </button>
          </div>

          {/* User Info */}
          {user && (
            <div className="glass-card p-6 mb-12 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-xl bg-gradient-aurora flex items-center justify-center text-void">
                  <User className="size-6" />
                </div>
                <div>
                  <div className="font-bold text-white">
                    {user.email?.split("@")[0]}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-imperial uppercase tracking-widest">
                    <Coins className="size-3" />
                    {coins} Coins
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  onNotificationsClick();
                  onClose();
                }}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 relative"
              >
                <Bell className="size-5 text-white/80" />
                <span className="absolute top-2 right-2 size-2 bg-aurora rounded-full border-2 border-void"></span>
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <div className="flex flex-col gap-6 mb-12">
            {["Oracle", "Matches", "Strategy", "Community"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={onClose}
                className="text-2xl font-bold text-white/60 hover:text-aurora flex items-center justify-between group"
              >
                {item}
                <ArrowRight className="size-6 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all" />
              </a>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="mt-auto">
            {!user ? (
              <button
                onClick={() => {
                  onAuthClick();
                  onClose();
                }}
                className="btn-primary w-full py-4 text-lg"
              >
                Get Started
              </button>
            ) : (
              <button
                onClick={() => {
                  onProfileClick();
                  onClose();
                }}
                className="btn-secondary w-full py-4 text-lg flex items-center justify-center gap-3"
              >
                <User className="size-5" />
                View Profile
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
