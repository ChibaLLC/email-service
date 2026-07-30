<template>
  <div class="space-y-6">
    <div class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">System status</h1>
        <p class="mt-1 text-sm text-gray-400">Redacted deployment and provider configuration reported by the server.</p>
      </div>
      <UButton color="neutral" variant="soft" icon="i-material-symbols-light-refresh" :loading="status === 'pending'" @click="() => refresh()">Refresh</UButton>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" title="System status unavailable" description="The server did not return deployment status." />
    <section v-else class="overflow-hidden rounded-xl bg-white/5 ring-1 ring-gray-800">
      <div class="flex items-center justify-between border-b border-gray-800 px-5 py-4">
        <div class="flex items-center gap-2">
          <span class="size-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/10" />
          <h2 class="font-medium">Deployment report</h2>
        </div>
        <UBadge color="neutral" variant="subtle">Redacted</UBadge>
      </div>
      <div class="p-5">
        <CodeBlock :code="systemPreview" lang="json" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "dashboard", middleware: ["auth"] });

const { data: system, status, error, refresh } = await useFetch<Record<string, unknown>>("/api/dashboard/system");
const systemPreview = computed(() => JSON.stringify(system.value || {}, null, 2));
</script>
