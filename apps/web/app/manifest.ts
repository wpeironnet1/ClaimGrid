import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ClaimGrid",
    short_name: "ClaimGrid",
    description: "Official-source mining-claim research, field evidence, and filing workflow organization.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f1e7",
    theme_color: "#172018",
    categories: ["productivity", "utilities", "education"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      { name: "Research map", short_name: "Map", url: "/explore", description: "Open the live BLM research map" },
      { name: "Claim project", short_name: "Project", url: "/claim/new", description: "Open the guided claim-project intake" },
      { name: "Deadlines", short_name: "Deadlines", url: "/deadlines", description: "Review locally tracked filing deadlines" }
    ]
  };
}
