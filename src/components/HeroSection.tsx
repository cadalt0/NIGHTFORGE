import { motion } from "framer-motion";
import VersionAnnouncement from "./VersionAnnouncement";
import { ArrowDown, Book, Github } from "lucide-react";
import { AnimatedGridBackground } from "@/components/ui/animated-grid-background";
import { TypingEffect } from "@/components/ui/typing-effect";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import TerminalAnimation from "@/components/TerminalAnimation";
import content from "@/data/content.json";
import siteConfig from "@/data/siteConfig.json";

const { hero } = content;

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden noise">
      <AnimatedGridBackground />
      {/* Version Announcement pill overlay */}
      <div className="fixed top-20 right-6 md:right-12 z-50">
        {/* Fixed pill overlay, always visible on Hero page */}
        <VersionAnnouncement />
      </div>

      <ContainerScroll
        titleComponent={
          <div className="pt-8 sm:pt-16 md:pt-24 px-2 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 sm:mb-8 rounded-full liquid-glass font-mono text-[10px] sm:text-xs text-primary"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
              {`${siteConfig.brand.version} — Initial Public Release`}
            </motion.div>

            <motion.h1
              className="text-4xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight leading-[1.02] mb-5 sm:mb-6"
            >
              <motion.span
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="block gradient-text pb-2"
              >
                {hero.titleLine1}
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25 }}
                className="block text-foreground"
              >
                {hero.titleLine2}
              </motion.span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-sm sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-4"
            >
              {hero.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.55 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8 sm:mb-12 px-4"
            >
              <a
                href={siteConfig.links.readme}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:brightness-110 transition-all shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.4)]"
              >
                {hero.ctaGetStarted}
                <ArrowDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
              </a>
              <a
                href="#docs"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl liquid-glass text-foreground font-semibold text-sm hover:bg-card/50 transition-all"
              >
                <Book className="w-4 h-4" />
                {hero.ctaDocs}
              </a>
              <a
                href={siteConfig.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl liquid-glass text-muted-foreground font-semibold text-sm hover:text-foreground transition-all"
              >
                <Github className="w-4 h-4" />
                {hero.ctaGithub}
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="px-4"
            >
              <TypingEffect />
            </motion.div>
          </div>
        }
      >
        <TerminalAnimation />
      </ContainerScroll>
    </section>
  );
};

export default HeroSection;
