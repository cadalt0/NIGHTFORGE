import React from "react";
import siteConfig from "@/data/siteConfig.json";

const VersionAnnouncement = () => {
  const version = siteConfig.brand.version;
  const [visible, setVisible] = React.useState(true);
  const [animate, setAnimate] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5000);
    // Trigger entrance animation
    setTimeout(() => setAnimate(true), 50);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <a
      href={siteConfig.links.changelog}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed top-20 right-6 md:right-12 z-50 flex items-center gap-3 px-5 py-2.5 rounded-full liquid-glass font-mono text-xs sm:text-sm text-primary bg-card/80 backdrop-blur-xl shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.25)] border border-primary/20 ${animate ? 'animate-pill-in' : ''} cursor-pointer transition-all hover:brightness-110`}
      style={{ borderRadius: "999px", minWidth: "180px", transform: animate ? 'translateY(0) scale(1)' : 'translateY(-40px) scale(0.85)', opacity: animate ? 1 : 0, transition: 'transform 0.7s cubic-bezier(0.16,1,0.3,1), opacity 0.7s cubic-bezier(0.16,1,0.3,1)' }}
      id="version-announcement-pill"
    >
      <span className="w-7 h-7 flex items-center justify-center rounded-full bg-primary/10 border border-primary/30 mr-2 shadow-sm">
        {/* Flash (lightning) icon */}
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M7 2v8h4v8l6-12h-4V2H7z" strokeWidth="1.5" fill="currentColor" />
        </svg>
      </span>
      <span className="font-bold tracking-wide">
        {version} released
      </span>
    </a>
  );
};

export default VersionAnnouncement;
