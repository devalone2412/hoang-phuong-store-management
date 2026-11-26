import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hoàng Phương",
    short_name: "Hoàng Phương",
    description: "Quản lý sản phẩm và tra giá nhanh cho cửa hàng Hoàng Phương.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f6",
    theme_color: "#0e6b55",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
