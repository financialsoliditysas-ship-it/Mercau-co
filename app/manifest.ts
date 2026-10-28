import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mercáu", short_name: "Mercáu", description: "Directorio, pedidos y entregas del Bajo Cauca.",
    start_url: "/", display: "standalone", background_color: "#d71f16", theme_color: "#d71f16",
    icons: [{ src: "/logo-mercau.png", sizes: "1024x1024", type: "image/png", purpose: "any" }],
  };
}
