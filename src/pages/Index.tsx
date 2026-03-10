import NavBar from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import WhatIsSection from "@/components/WhatIsSection";
import ProblemSolutionSection from "@/components/ProblemSolutionSection";
import FeaturesSection from "@/components/FeaturesSection";
import WorkflowSection from "@/components/WorkflowSection";
import DocsSection from "@/components/DocsSection";
import ReleaseSection from "@/components/ReleaseSection";
import FAQSection from "@/components/FAQSection";
import FinalCTASection from "@/components/FinalCTASection";
import FooterSection from "@/components/FooterSection";
import { LiquidGlassFilter } from "@/components/ui/liquid-glass";

const Index = () => {
  return (
    <div className="min-h-screen bg-background scroll-smooth">
      <LiquidGlassFilter />
      <NavBar />
      <HeroSection />
      <WhatIsSection />
      <ProblemSolutionSection />
      <FeaturesSection />
      <WorkflowSection />
      <DocsSection />
      <ReleaseSection />
      <FAQSection />
      <FinalCTASection />
      <FooterSection />
    </div>
  );
};

export default Index;
