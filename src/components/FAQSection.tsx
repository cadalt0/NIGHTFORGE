import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { MessageCircle } from "lucide-react";
import content from "@/data/content.json";

const { faq } = content;

const FAQSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="faq" className="py-20 sm:py-28 md:py-36 relative section-glow-top">
      <div className="container px-4 sm:px-6 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-12 sm:mb-16"
        >
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl liquid-glass mb-5">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-3">{faq.title}</h2>
          <p className="text-muted-foreground text-sm sm:text-base">{faq.subtitle}</p>
        </motion.div>

        <div ref={ref}>
          <Accordion type="single" collapsible className="space-y-3">
            {faq.items.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <AccordionItem
                  value={`faq-${i}`}
                  className="rounded-xl px-4 sm:px-6 liquid-glass data-[state=open]:liquid-glass-strong data-[state=open]:shadow-[0_12px_48px_-12px_hsl(var(--primary)/0.15)] transition-all duration-300"
                >
                  <AccordionTrigger className="text-xs sm:text-sm font-semibold text-foreground hover:no-underline py-5 sm:py-6 gap-4">
                    <span className="text-left">{f.q}</span>
                  </AccordionTrigger>
                  <AccordionContent className="text-xs sm:text-sm text-muted-foreground leading-relaxed pb-5 sm:pb-6">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
