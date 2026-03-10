import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Github, Menu, X } from "lucide-react";
import content from "@/data/content.json";
import siteConfig from "@/data/siteConfig.json";

const NavBar = () => {
  const [visible, setVisible] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const heroHeight = window.innerHeight;
      setVisible(window.scrollY > heroHeight * 0.85);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.header
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-0 left-0 right-0 z-50 liquid-glass-strong"
          style={{ borderBottom: "1px solid hsl(210 20% 90% / 0.06)" }}
        >
          <div className="container max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 sm:h-16">
            <a href="#" className="flex items-center gap-2 font-mono font-bold text-foreground text-sm">
              <span className="text-primary text-lg">{siteConfig.brand.emoji}</span>
              <span>{siteConfig.brand.name}</span>
            </a>

            <nav className="hidden md:flex items-center gap-6 lg:gap-8">
              {content.nav.items.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono relative group"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-px bg-primary group-hover:w-full transition-all duration-300" />
                </a>
              ))}
              <a
                href={siteConfig.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg liquid-glass text-sm text-primary hover:text-foreground transition-all font-mono"
              >
                <Github className="w-4 h-4" />
                {content.nav.githubLabel}
              </a>
            </nav>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-muted-foreground hover:text-foreground"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden liquid-glass overflow-hidden"
              >
                <nav className="container px-4 py-4 flex flex-col gap-3">
                  {content.nav.items.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="text-sm text-muted-foreground hover:text-foreground font-mono py-2"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>
      )}
    </AnimatePresence>
  );
};

export default NavBar;
