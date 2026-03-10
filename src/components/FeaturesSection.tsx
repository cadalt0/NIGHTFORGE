import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { FolderPlus, Hammer, Wallet, Server, Rocket, BookOpen } from "lucide-react";
import content from "@/data/content.json";

const { features: featuresData } = content;

const iconMap: Record<string, any> = { FolderPlus, Hammer, Wallet, Server, Rocket, BookOpen };

const FeaturesSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="features" className="py-20 sm:py-28 md:py-36 relative section-glow-top noise">
      <div className="container px-4 sm:px-6 max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-14 sm:mb-20"
        >
          <p className="font-mono text-xs text-primary/60 uppercase tracking-[0.25em] mb-3">{featuresData.sectionLabel}</p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4">{featuresData.title}</h2>
          <p className="text-muted-foreground max-w-md mx-auto text-sm sm:text-base">
            {featuresData.subtitle}
          </p>
        </motion.div>

        <div ref={ref} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {featuresData.items.map((f, i) => {
            const Icon = iconMap[f.icon];
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 40, scale: 0.95, rotate: i % 2 === 0 ? -1 : 1 }}
                animate={inView ? { opacity: 1, y: 0, scale: 1, rotate: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="group relative rounded-2xl liquid-glass overflow-hidden transition-all hover:bg-card/50"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-accent/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative p-5 sm:p-6">
                  <div className="relative w-11 h-11 mb-5">
                    <div className="absolute inset-0 rounded-xl bg-primary/[0.08] group-hover:bg-primary/[0.12] transition-colors backdrop-blur-sm" />
                    <div className="absolute inset-0 rounded-xl border border-white/[0.04] group-hover:border-white/[0.08] group-hover:scale-110 transition-all duration-300" />
                    <div className="relative w-full h-full flex items-center justify-center">
                      {Icon && <Icon className="w-5 h-5 text-primary" />}
                    </div>
                  </div>

                  <h3 className="font-bold text-foreground text-base sm:text-lg mb-2">{f.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4">{f.desc}</p>

                  <div className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-mono px-3 py-1.5 rounded-lg bg-background/40 backdrop-blur-sm border border-white/[0.05]">
                    <span className="text-primary">$</span>
                    <span className="text-muted-foreground">nightforge {f.cmd}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
