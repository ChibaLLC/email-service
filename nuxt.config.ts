import tailwind from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ["@nuxt/ui", "nuxt-echarts"],
  compatibilityDate: "2025-02-04",
  telemetry: {
    enabled: false,
  },
  css: ["~/assets/css/main.css"],
  vite: {
    plugins: [tailwind() as any],
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit", "zod", "shiki"],
    },
  },
  nitro: {
    rollupConfig: {
      plugins: [vue()],
    },
  },
  runtimeConfig: {
    public: {
      allowedDomains: process.env.ALLOWED_DOMAINS || "ifkafin.com,finueva.com,heilomeet.com",
    },
  },
  echarts: {
    renderer: "canvas",
    charts: ["BarChart", "LineChart", "PieChart", "GaugeChart"],
    components: ["DatasetComponent", "GridComponent", "TooltipComponent", "LegendComponent", "TitleComponent"],
  },
  routeRules: {
    "/dashboard/**": { ssr: false },
  },
});
