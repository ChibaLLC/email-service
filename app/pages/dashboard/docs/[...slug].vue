<template>
  <div class="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
    <aside class="lg:sticky lg:top-6 lg:self-start">
      <div class="rounded-xl bg-white/5 p-3 ring-1 ring-gray-800">
        <div class="mb-3 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-[0.16em] text-lime-400">
          <Icon name="material-symbols-light:menu-book-outline" class="size-4" />
          User guide
        </div>
        <nav class="space-y-1">
          <NuxtLink v-for="item in flatNavigation" :key="item.path" :to="item.path" class="block rounded-lg px-3 py-2 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white" active-class="bg-lime-400/10 !text-lime-300 ring-1 ring-lime-400/20">
            {{ item.title }}
          </NuxtLink>
        </nav>
      </div>
    </aside>

    <main class="min-w-0 overflow-hidden rounded-xl bg-white/[0.035] ring-1 ring-gray-800">
      <article v-if="page" class="docs-prose px-5 py-7 sm:px-8 lg:px-10">
        <div class="mb-8 border-b border-gray-800 pb-6">
          <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-lime-400">Email Service Handbook</p>
          <h1 class="text-3xl font-semibold tracking-tight text-white">{{ page.title }}</h1>
          <p v-if="page.description" class="mt-3 max-w-3xl text-base leading-7 text-gray-400">{{ page.description }}</p>
        </div>
        <ContentRenderer :value="page" />
      </article>
      <div v-else class="p-10 text-center">
        <h1 class="text-xl font-semibold">Guide not found</h1>
        <UButton class="mt-4" to="/dashboard/docs">Open documentation</UButton>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "dashboard", middleware: ["auth"] });
const route = useRoute();
const { data: page } = await useAsyncData(`docs:${route.path}`, () => queryCollection("docs").path(route.path).first(), { watch: [() => route.path] });
const { data: navigation } = await useAsyncData("docs:navigation", () => queryCollectionNavigation("docs"));
const flatNavigation = computed(() => (navigation.value || []).flatMap((item) => item.children?.length ? item.children : [item]));
useSeoMeta({ title: () => page.value ? `${page.value.title} - Email Service` : "Documentation - Email Service", description: () => page.value?.description });
</script>

<style>
.docs-prose h2 { margin-top: 2.5rem; font-size: 1.4rem; font-weight: 600; color: white; }
.docs-prose h3 { margin-top: 2rem; font-size: 1.1rem; font-weight: 600; color: rgb(229 231 235); }
.docs-prose p { margin-top: 1rem; line-height: 1.75; color: rgb(156 163 175); }
.docs-prose ul, .docs-prose ol { margin-top: 1rem; padding-left: 1.5rem; color: rgb(156 163 175); }
.docs-prose li { margin-top: .5rem; }
.docs-prose a { color: rgb(190 242 100); text-decoration: underline; text-underline-offset: 3px; }
.docs-prose code:not(pre code) { border-radius: .35rem; background: rgb(17 24 39); padding: .15rem .35rem; color: rgb(186 230 253); }
.docs-prose pre { margin-top: 1.25rem; overflow-x: auto; border: 1px solid rgb(31 41 55); border-radius: .75rem; background: rgb(3 7 18); padding: 1rem; font-size: .82rem; color: rgb(209 250 229); }
.docs-prose blockquote { margin-top: 1.25rem; border-left: 3px solid rgb(163 230 53); background: rgb(163 230 53 / .06); padding: .5rem 1rem 1rem; }
.docs-prose table { margin-top: 1.25rem; width: 100%; border-collapse: collapse; font-size: .9rem; }
.docs-prose th, .docs-prose td { border-bottom: 1px solid rgb(31 41 55); padding: .7rem; text-align: left; }
.docs-prose th { color: rgb(229 231 235); }
</style>
