import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ExternalLink, FileText, Terminal, BookOpen, HelpCircle, Users, FolderPlus, Hammer, Wallet, Server, Rocket, Trash2 } from "lucide-react";
import content from "@/data/content.json";
import { resolveLink } from "@/lib/links";

const { docs } = content;

const iconMap: Record<string, any> = { FileText, Terminal, BookOpen, HelpCircle, Users, FolderPlus, Hammer, Wallet, Server, Rocket, Trash2 };

const DocsSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="docs" className="py-20 sm:py-28 md:py-36 relative section-glow-top noise">
      <div className="container px-4 sm:px-6 max-w-5xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mb-12 sm:mb-20"
        >
          <div className="grid lg:grid-cols-2 gap-4 items-end">
            <div>
              <p className="font-mono text-xs text-primary/60 uppercase tracking-[0.25em] mb-3">{docs.sectionLabel}</p>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold">{docs.title}</h2>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base lg:text-right">
              {docs.subtitle}
            </p>
          </div>
        </motion.div>

        <div ref={ref} className="space-y-10 sm:space-y-14">
          {docs.categories.map((category, catIdx) => (
            <div key={category.title}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: catIdx * 0.15, duration: 0.5 }}
                className="flex items-center gap-3 mb-4 sm:mb-5"
              >
                <div className="h-px flex-1 max-w-[40px] bg-gradient-to-r from-primary/20 to-transparent" />
                <h3 className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.25em] text-primary/50">
                  {category.title}
                </h3>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {category.items.map((item, i) => {
                  const Icon = iconMap[item.icon];
                  const href = resolveLink(item.linkKey);
                  return (
                    <motion.a
                      key={item.label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 20, scale: 0.97 }}
                      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
                      transition={{
                        delay: catIdx * 0.15 + i * 0.06,
                        duration: 0.5,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      whileHover={{ y: -3, scale: 1.01 }}
                      className="group relative p-4 rounded-xl liquid-glass hover:bg-card/50 transition-all"
                    >
                      <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-primary/0 group-hover:bg-primary/40 transition-all duration-300" />

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/[0.06] backdrop-blur-sm flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          {Icon && <Icon className="w-4 h-4 text-primary/60 group-hover:text-primary transition-colors" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-sm font-semibold text-foreground">{item.label}</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    </motion.a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DocsSection;
