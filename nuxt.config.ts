import tailwind from "@tailwindcss/vite"
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ["@nuxt/ui"],
  extends: ["github:kgarchie/nuxt-starter"],
  compatibilityDate: "2025-02-04",
  telemetry: {
	enabled: false
  },
  css: ["~/assets/css/main.css"],
  vite: {
	plugins: [tailwind() as any]
  }
});
