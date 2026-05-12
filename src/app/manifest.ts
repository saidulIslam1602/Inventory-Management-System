import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aqila IMS",
    short_name: "Aqila IMS",
    description:
      "Inventory & management for Aqila AS — stock, employees, projects, and purchase orders.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/brand/ims-grid.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}
