import siteConfig from "@/data/siteConfig.json";

/**
 * Resolve a linkKey like "readme" or "commands.init" to a URL from siteConfig.
 */
export function resolveLink(linkKey: string): string {
  const parts = linkKey.split(".");
  let current: any = siteConfig.links;
  for (const part of parts) {
    current = current?.[part];
  }
  return typeof current === "string" ? current : "#";
}
