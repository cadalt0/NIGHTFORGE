import { useState } from "react";
import { Copy, Check } from "lucide-react";
import siteConfig from "@/data/siteConfig.json";

const installCommand = siteConfig.brand.installCommand;

export const TypingEffect = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="code-block inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3.5 max-w-full cursor-pointer hover:brightness-110 transition-all group"
    >
      <span className="text-primary font-mono font-bold text-sm">$</span>
      <code className="text-foreground font-mono text-xs sm:text-sm">
        {installCommand}
      </code>
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-colors" />
      )}
    </button>
  );
};
