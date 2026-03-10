import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { X, Zap } from "lucide-react";
import content from "@/data/content.json";

const { problemSolution: ps } = content;

const ProblemSolutionSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="py-20 sm:py-28 md:py-36 relative overflow-hidden section-glow-top">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-destructive/[0.02] via-transparent to-primary/[0.02]" />
      </div>

      <div className="container px-4 sm:px-6 max-w-5xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-12 sm:mb-20"
        >
          <p className="font-mono text-xs text-primary/60 uppercase tracking-[0.25em] mb-3">{ps.sectionLabel}</p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold">
            {ps.title} <span className="gradient-text">{ps.titleHighlight}</span>?
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
          <div className="space-y-3">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.2 }}
              className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.25em] text-destructive/50 mb-4 sm:mb-6"
            >
              {ps.withoutLabel}
            </motion.h3>
            {ps.problems.map((p, i) => (
              <motion.div
                key={p}
                initial={{ opacity: 0, x: -30, rotate: -1 }}
                animate={inView ? { opacity: 1, x: 0, rotate: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.12, duration: 0.5, ease: "easeOut" }}
                className="flex items-start gap-3 p-4 rounded-xl liquid-glass border-destructive/[0.08]"
                style={{ borderColor: "hsl(0 72% 55% / 0.08)" }}
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center mt-0.5">
                  <X className="w-3 h-3 text-destructive/70" />
                </div>
                <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{p}</span>
              </motion.div>
            ))}
          </div>

          <div>
            <motion.h3
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.4 }}
              className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.25em] text-primary/50 mb-4 sm:mb-6"
            >
              {ps.withLabel}
            </motion.h3>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
              transition={{ delay: 0.6, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="h-full p-6 sm:p-8 rounded-2xl liquid-glass-strong relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/[0.06] blur-[60px] rounded-full" />
              
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-primary/[0.08] backdrop-blur-sm flex items-center justify-center mb-5">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <p className="text-foreground leading-relaxed text-lg sm:text-xl font-bold mb-3">
                  {ps.solutionTitle}
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {ps.solutionDesc}
                </p>

                <div className="mt-6 pt-5 border-t border-white/[0.06] flex items-center gap-6">
                  {ps.stats.map((stat) => (
                    <div key={stat.label}>
                      <p className="text-2xl font-bold text-primary font-mono">{stat.value}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSolutionSection;
