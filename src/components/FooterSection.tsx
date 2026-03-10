import { Heart } from "lucide-react";
import content from "@/data/content.json";
import siteConfig from "@/data/siteConfig.json";
import { resolveLink } from "@/lib/links";

const FooterSection = () => {
  return (
    <footer className="py-10 sm:py-14 relative liquid-glass" style={{ borderTop: "1px solid hsl(210 20% 90% / 0.06)" }}>
      <div className="container px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="text-primary text-xl">{siteConfig.brand.emoji}</span>
            <div>
              <span className="font-mono text-sm text-foreground font-semibold">{siteConfig.brand.name}</span>
              <span className="font-mono text-xs text-muted-foreground ml-2">{siteConfig.brand.version}</span>
            </div>
          </div>

          <nav className="flex items-center gap-5 sm:gap-6">
            {content.footer.links.map((l) => {
              const href = l.href || (l.linkKey ? resolveLink(l.linkKey) : "#");
              const isExternal = href.startsWith("http");
              return (
                <a
                  key={l.label}
                  href={href}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
                >
                  {l.label}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground/60 font-mono" style={{ borderTop: "1px solid hsl(210 20% 90% / 0.04)" }}>
          <span>{siteConfig.brand.license}</span>
          <span className="flex items-center gap-1">
            {siteConfig.brand.tagline} <Heart className="w-3 h-3 text-primary/40 inline" />
          </span>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
