import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Zap, FileCode, Wallet, Server, Rocket } from "lucide-react";
import content from "@/data/content.json";

const { whatIs } = content;

const iconMap: Record<string, any> = { Zap, FileCode, Wallet, Server, Rocket };

const WhatIsSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-20 sm:py-28 md:py-36 relative noise section-glow-top">
      <div className="container px-4 sm:px-6 max-w-5xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-[1.2fr,1fr] gap-8 lg:gap-16 items-end mb-14 sm:mb-20">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="font-mono text-xs text-primary/60 uppercase tracking-[0.25em] mb-3">{whatIs.sectionLabel}</p>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05]">
              {whatIs.title}{" "}
              <span className="gradient-text">{whatIs.titleHighlight}</span>
            </h2>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-muted-foreground text-sm sm:text-base leading-relaxed lg:text-right"
          >
            {whatIs.subtitle}
          </motion.p>
        </div>

        <div ref={ref} className="space-y-3 sm:space-y-4 max-w-3xl">
          {whatIs.bullets.map((item, i) => {
            const Icon = iconMap[item.icon];
            return (
              <motion.div
                key={item.text}
                initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50, filter: "blur(8px)" }}
                animate={inView ? { opacity: 1, x: 0, filter: "blur(0px)" } : {}}
                transition={{ delay: i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="group flex items-center gap-4 sm:gap-5 p-4 sm:p-5 rounded-2xl liquid-glass hover:bg-card/50 transition-all cursor-default"
              >
                <div className="flex-shrink-0 w-11 h-11 sm:w-13 sm:h-13 rounded-xl bg-primary/[0.08] backdrop-blur-sm flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/[0.12] transition-all duration-300">
                  {Icon && <Icon className="w-5 h-5 text-primary" />}
                </div>
                <span className="text-foreground font-medium text-sm sm:text-base">{item.text}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhatIsSection;
