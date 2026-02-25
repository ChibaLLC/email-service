// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ["@nuxt/ui"],
  future: {
    compatibilityVersion: 4,
  },
  extends: ["github:kgarchie/nuxt-starter"],
  compatibilityDate: "2025-02-04",
  nitro: {
    imports: {
      dirs: ["./shared/utils", "./shared/types"],
    },
  },
  imports: {
    dirs: ["../shared/types", "../shared/utils"],
  },
  telemetry: {
	enabled: false
  }
});
