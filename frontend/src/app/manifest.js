// Web app manifest: the Nexarrow mark when UIPL Docs is added to a phone's home screen or installed.
export default function manifest() {
  return {
    name: "UIPL Docs",
    short_name: "UIPL Docs",
    description: "UIPL Docs for efficient operations and document intelligence.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon-192.png", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512", purpose: "any" },
      { src: "/icon-maskable-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
