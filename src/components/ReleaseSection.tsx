import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Check, Sparkles, ArrowUpRight } from "lucide-react";
import content from "@/data/content.json";
import siteConfig from "@/data/siteConfig.json";

const { release } = content;

const ReleaseSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-20 sm:py-28 md:py-36 relative section-glow-top">
      <div className="container px-4 sm:px-6 max-w-4xl mx-auto">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 50, scale: 0.96 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl overflow-hidden liquid-glass-strong"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/[0.03]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-primary/[0.08] blur-[100px] rounded-full" />
          <div className="absolute bottom-0 right-0 w-[200px] h-[200px] bg-accent/[0.04] blur-[80px] rounded-full" />

          <div className="relative p-6 sm:p-10 md:p-14">
            <motion.a
              href={siteConfig.links.latestRelease}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="inline-flex items-center gap-2 mb-6 sm:mb-8 px-4 py-2 rounded-full liquid-glass font-mono text-[10px] sm:text-xs text-primary hover:bg-card/50 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {release.badgeLabel}
              <ArrowUpRight className="w-3 h-3" />
            </motion.a>

            <div className="grid lg:grid-cols-[1.3fr,1fr] gap-8 lg:gap-12">
              <div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 leading-tight">
                  {release.titleLine1}
                  <br />
                  <span className="gradient-text">{release.titleLine2}</span>
                </h2>
                <p className="font-mono text-primary text-sm mb-5">{siteConfig.brand.version}</p>
                <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                  {release.description}
                </p>
              </div>

              <div className="space-y-2.5">
                {release.bullets.map((b, i) => (
                  <motion.div
                    key={b}
                    initial={{ opacity: 0, x: 20 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
                    className="flex items-start gap-3 p-3 rounded-xl liquid-glass"
                  >
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-xs sm:text-sm text-foreground/80 leading-relaxed">{b}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ReleaseSection;
