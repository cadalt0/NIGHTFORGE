import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import content from "@/data/content.json";

const { workflow } = content;

const WorkflowSection = () => {
  const containerRef = useRef(null);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end center"],
  });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section id="quickstart" className="py-20 sm:py-28 md:py-36 relative section-glow-top" ref={containerRef}>
      <div className="container px-4 sm:px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-12 sm:mb-20"
        >
          <p className="font-mono text-xs text-primary/60 uppercase tracking-[0.25em] mb-3">{workflow.sectionLabel}</p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4">{workflow.title}</h2>
          <p className="text-muted-foreground text-sm sm:text-base">{workflow.subtitle}</p>
        </motion.div>

        <div ref={ref} className="relative">
          <div className="absolute left-[27px] sm:left-[31px] top-0 bottom-0 w-px bg-border hidden sm:block">
            <motion.div
              style={{ height: lineHeight }}
              className="w-full bg-gradient-to-b from-primary via-primary/50 to-transparent"
            />
          </div>

          <div className="space-y-4 sm:space-y-5">
            {workflow.steps.map((s, i) => (
              <motion.div
                key={s.cmd}
                initial={{ opacity: 0, x: -30, filter: "blur(6px)" }}
                animate={inView ? { opacity: 1, x: 0, filter: "blur(0px)" } : {}}
                transition={{ delay: i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="group flex items-center gap-4 sm:gap-6"
              >
                <div className="relative z-10 flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl liquid-glass flex flex-col items-center justify-center group-hover:bg-card/50 transition-all">
                  <span className="text-base sm:text-lg">{s.emoji}</span>
                  <span className="font-mono text-[9px] text-muted-foreground">{s.num}</span>
                </div>

                <div className="flex-1 min-w-0 p-3 sm:p-4 rounded-xl liquid-glass group-hover:bg-card/50 transition-all">
                  <div className="flex items-center justify-between gap-2 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <span className="text-primary font-mono text-sm font-bold">$</span>
                      <code className="text-foreground font-mono text-xs sm:text-sm truncate">{s.example}</code>
                    </div>
                    <span className="hidden sm:block text-[10px] font-mono text-muted-foreground/60 px-2 py-0.5 rounded-md bg-background/30 backdrop-blur-sm">{s.desc}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WorkflowSection;
