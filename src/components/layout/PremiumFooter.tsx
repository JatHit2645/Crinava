import React from "react";
import {
  Twitter,
  Github,
  Linkedin,
  Mail,
  ArrowRight,
  Shield,
  Zap,
  Globe,
} from "lucide-react";

const FooterLinkItem = ({ item }: { item: string }) => (
  <li>
    <a
      href={`#${item.toLowerCase().replace(" ", "-")}`}
      className="text-white/40 text-sm hover:text-aurora transition-colors flex items-center gap-2 group"
    >
      <ArrowRight className="size-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
      {item}
    </a>
  </li>
);

/**
 * Renders a premium footer with branding, platform and resource links, social icons, newsletter signup, and legal links.
 * @example
 * PremiumFooter()
 * <footer>...</footer>
 * @returns {JSX.Element} The footer section for the page layout.
 **/
export const PremiumFooter: React.FC = () => {
  return (
    <footer className="relative pt-24 pb-12 px-6 overflow-hidden">
      {/* Background Decoration */}
      <div className="glow-orb glow-orb-aurora w-[400px] h-[400px] bottom-[-200px] left-[-100px] opacity-20"></div>
      <div className="glow-orb glow-orb-imperial w-[300px] h-[300px] bottom-[-150px] right-[-100px] opacity-20"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-24">
          {/* Brand Section */}
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="size-10 rounded-xl bg-gradient-aurora flex items-center justify-center shadow-aurora group-hover:scale-110 transition-transform duration-500">
                <span className="text-void font-bold text-xl">C</span>
              </div>
              <span className="text-xl font-bold tracking-tighter text-gradient-white">
                CRINAVA
              </span>
            </div>
            <p className="text-white/40 text-sm leading-relaxed">
              The world's most advanced AI-driven cricket analytics platform.
              Precision intelligence for the modern game.
            </p>
            <div className="flex items-center gap-4">
              {[Twitter, Github, Linkedin, Mail].map((Icon, idx) => (
                <button
                  key={idx}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-aurora/40 hover:bg-white/10 hover:text-aurora transition-all duration-300"
                >
                  <Icon className="size-5" />
                </button>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-bold mb-8 uppercase tracking-widest text-xs">
              Platform
            </h4>
            <ul className="flex flex-col gap-4">
              {[
                "Oracle Engine",
                "Match Center",
                "Strategy Hub",
                "Community",
                "Leaderboard",
              ].map((item) => (
                <FooterLinkItem key={item} item={item} />
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-bold mb-8 uppercase tracking-widest text-xs">
              Resources
            </h4>
            <ul className="flex flex-col gap-4">
              {[
                "Documentation",
                "API Access",
                "Case Studies",
                "Research Papers",
                "Help Center",
              ].map((item) => (
                <FooterLinkItem key={item} item={item} />
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-white font-bold mb-8 uppercase tracking-widest text-xs">
              Stay Updated
            </h4>
            <p className="text-white/40 text-sm mb-6 leading-relaxed">
              Get the latest insights and simulation reports delivered to your
              inbox.
            </p>
            <div className="relative group">
              <input
                type="email"
                placeholder="Enter your email"
                className="input-premium pr-12"
              />
              <button className="absolute right-2 top-2 p-2 rounded-lg bg-aurora text-void hover:shadow-aurora transition-all duration-300">
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-white/40 text-xs font-medium">
            © 2026 CRINAVA INTELLIGENCE. ALL RIGHTS RESERVED.
          </div>
          <div className="flex items-center gap-8">
            {["Privacy Policy", "Terms of Service", "Cookie Policy"].map(
              (item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(" ", "-")}`}
                  className="text-white/40 text-xs hover:text-aurora transition-colors"
                >
                  {item}
                </a>
              ),
            )}
          </div>
          <div className="flex items-center gap-3 opacity-40">
            <Shield className="size-4" />
            <Zap className="size-4" />
            <Globe className="size-4" />
          </div>
        </div>
      </div>
    </footer>
  );
};
