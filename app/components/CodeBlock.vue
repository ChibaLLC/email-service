<template>
  <div class="code-block relative rounded-lg overflow-hidden ring-1 ring-gray-800">
    <div v-if="html" v-html="html" class="shiki-container text-sm p-4 overflow-x-auto" />
    <pre v-else class="text-sm bg-gray-900 text-gray-300 p-4 overflow-x-auto"><code>{{ code }}</code></pre>
  </div>
</template>

<script setup lang="ts">
import { codeToHtml } from "shiki";

const props = defineProps<{
  code: string;
  lang?: string;
}>();

const html = ref("");

async function highlight() {
  if (!props.code) return;
  try {
    html.value = await codeToHtml(props.code, {
      lang: props.lang || "text",
      theme: "github-dark",
    });
  } catch {
    html.value = "";
  }
}

watch(() => props.code, highlight, { immediate: true });
</script>

<style>
.shiki-container pre {
  margin: 0;
  padding: 0;
  background: transparent !important;
}
.shiki-container code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
.code-block {
  background: rgb(13 17 23);
}
</style>
