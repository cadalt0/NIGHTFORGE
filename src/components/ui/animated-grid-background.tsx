import { motion } from "framer-motion";

export const AnimatedGridBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--primary) / 0.4) 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />
      {/* Hero glow - warm */}
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-primary/[0.06] blur-[160px]" />
      {/* Side accents */}
      <motion.div
        animate={{ y: [0, -20, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[30%] left-[5%] w-40 h-40 rounded-full bg-ember/[0.06] blur-[80px]"
      />
      <motion.div
        animate={{ y: [0, 15, 0], scale: [1, 0.95, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute top-[20%] right-[8%] w-32 h-32 rounded-full bg-forge/[0.05] blur-[60px]"
      />
      {/* Scan line */}
      <motion.div
        animate={{ y: ["-100%", "300%"] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent"
      />
    </div>
  );
};
