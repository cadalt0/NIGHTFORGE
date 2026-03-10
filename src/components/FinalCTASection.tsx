import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Github, Flame } from "lucide-react";
import content from "@/data/content.json";
import siteConfig from "@/data/siteConfig.json";

const { finalCta } = content;

const FinalCTASection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-20 sm:py-28 md:py-36 relative overflow-hidden section-glow-top">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/[0.06] blur-[160px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-accent/[0.04] blur-[100px] rounded-full" />
      </div>

      <div ref={ref} className="container px-4 sm:px-6 max-w-3xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0, rotate: -180 }}
          animate={inView ? { opacity: 1, scale: 1, rotate: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-3xl liquid-glass-strong mb-8"
        >
          <Flame className="w-7 h-7 text-primary" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.15, duration: 0.7 }}
          className="text-4xl sm:text-5xl md:text-6xl font-bold mb-5 leading-tight"
        >
          {finalCta.titleLine1}
          <br />
          <span className="gradient-text glow-text">{finalCta.titleLine2}</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-muted-foreground mb-10 text-sm sm:text-lg max-w-lg mx-auto"
        >
          {finalCta.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-10"
        >
          <a
            href={siteConfig.links.readme}
            target="_blank"
            rel="noopener noreferrer"
            className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:brightness-110 transition-all shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.4)]"
          >
            {finalCta.ctaPrimary}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
          <a
            href={siteConfig.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl liquid-glass text-foreground font-bold text-sm hover:bg-card/50 transition-all"
          >
            <Github className="w-4 h-4" />
            {finalCta.ctaSecondary}
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="inline-flex items-center gap-3 px-5 sm:px-6 py-3.5 sm:py-4 rounded-xl liquid-glass font-mono"
        >
          <span className="text-primary font-bold">$</span>
          <code className="text-foreground text-xs sm:text-sm">{finalCta.installCommand}</code>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCTASection;
