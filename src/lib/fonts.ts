import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

// Fonts are downloaded at build time and served from the site itself.
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
});

export const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500"],
});

export const fontVariables = `${inter.variable} ${fraunces.variable} ${jetbrains.variable}`;
