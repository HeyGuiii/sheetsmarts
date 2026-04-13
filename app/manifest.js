export default function manifest() {
  return {
    name: "SheetSmarts",
    short_name: "SheetSmarts",
    description: "Snap sheet music, hear it play, and practice with feedback!",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF8F0",
    theme_color: "#3B82F6",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
