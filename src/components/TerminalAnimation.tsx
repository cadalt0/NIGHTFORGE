import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import content from "@/data/content.json";

interface TerminalLine {
  type: "command" | "output" | "success" | "spinner" | "highlight";
  text: string;
  delay: number;
}

const lines = content.terminal.lines as TerminalLine[];

const TerminalAnimation = () => {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [typingIndex, setTypingIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const hasStarted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    let cancelled = false;

    const showLines = async () => {
      for (let i = 0; i < lines.length; i++) {
        if (cancelled) return;
        const line = lines[i];
        await new Promise((r) => setTimeout(r, line.delay));
        if (cancelled) return;

        if (line.type === "command") {
          setIsTyping(true);
          setTypingIndex(0);
          setVisibleLines(i);

          for (let c = 0; c <= line.text.length; c++) {
            if (cancelled) return;
            setTypingIndex(c);
            await new Promise((r) => setTimeout(r, 30 + Math.random() * 40));
          }

          setIsTyping(false);
          setVisibleLines(i + 1);
        } else {
          setVisibleLines(i + 1);
        }
      }
    };

    showLines();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleLines, typingIndex]);

  const getLineClass = (line: TerminalLine) => {
    switch (line.type) {
      case "command": return "";
      case "highlight": return "text-primary font-semibold";
      default: return "text-muted-foreground";
    }
  };

  const isNewGroup = (i: number) => i > 0 && lines[i].type === "command";

  return (
    <div className="h-full w-full bg-background rounded-xl sm:rounded-2xl p-3 sm:p-6 flex flex-col font-mono text-xs sm:text-sm">
      <div className="flex items-center gap-2 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-border flex-shrink-0">
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-destructive/60" />
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-primary/40" />
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500/40" />
        <span className="ml-2 sm:ml-3 text-muted-foreground text-[10px] sm:text-xs">{content.terminal.title}</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 sm:space-y-1.5">
        {lines.slice(0, visibleLines).map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className={`${isNewGroup(i) ? "pt-2 sm:pt-3" : ""}`}
          >
            {line.type === "command" ? (
              <p>
                <span className="text-primary">$</span>{" "}
                <span className="text-foreground">{line.text}</span>
              </p>
            ) : (
              <p className={getLineClass(line)}>{line.text}</p>
            )}
          </motion.div>
        ))}

        {isTyping && (
          <div className={`${isNewGroup(visibleLines) ? "pt-2 sm:pt-3" : ""}`}>
            <p>
              <span className="text-primary">$</span>{" "}
              <span className="text-foreground">
                {lines[visibleLines]?.text.slice(0, typingIndex)}
              </span>
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.4, repeat: Infinity, repeatType: "reverse" }}
                className="inline-block w-1.5 sm:w-2 h-3.5 sm:h-4 bg-primary ml-0.5 align-middle"
              />
            </p>
          </div>
        )}

        {visibleLines >= lines.length && !isTyping && (
          <div className="pt-2 sm:pt-3">
            <p>
              <span className="text-primary">$</span>{" "}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                className="inline-block w-1.5 sm:w-2 h-3.5 sm:h-4 bg-primary align-middle"
              />
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalAnimation;
