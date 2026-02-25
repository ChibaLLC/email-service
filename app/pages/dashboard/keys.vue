<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <!-- Header -->
    <header class="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <div class="flex items-center gap-3">
          <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-material-symbols-light-arrow-back">
            Back
          </UButton>
          <h1 class="text-lg font-bold">API Keys</h1>
        </div>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <!-- Keys Table -->
      <div class="rounded-xl bg-white/5 ring-1 ring-gray-800 p-5 overflow-hidden">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-medium text-gray-400">All API Keys</h3>
          <UBadge color="primary" variant="subtle"> {{ keys?.length ?? 0 }} keys </UBadge>
        </div>

        <div class="space-y-3" v-if="keys && keys.length > 0">
          <div
            v-for="key in keys"
            :key="key.id"
            class="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3 ring-1 ring-gray-800"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <code class="text-sm text-gray-300 font-mono">{{ key.keyPrefix }}</code>
                <UBadge :color="key.active ? 'success' : 'error'" variant="subtle" size="xs">
                  {{ key.active ? "Active" : "Revoked" }}
                </UBadge>
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {{ key.email }} · Created {{ formatDate(key.createdAt) }}
                <span v-if="key.lastUsedAt"> · Last used {{ formatDate(key.lastUsedAt) }}</span>
              </div>
            </div>
            <UButton
              v-if="key.active"
              @click="revokeKey(key.id)"
              variant="ghost"
              color="error"
              size="sm"
              icon="i-material-symbols-light-delete-outline"
              :loading="revoking === key.id"
            >
              Revoke
            </UButton>
          </div>
        </div>

        <div v-else class="text-center py-12 text-gray-500">
          <UIcon name="i-material-symbols-light-key-off-outline" class="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No API keys found</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false });

const toast = useToast();
const revoking = ref<string | null>(null);

const { data: keys, refresh } = await useFetch<any[]>("/api/keys", {
  default: () => [],
});

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function revokeKey(id: string) {
  revoking.value = id;
  try {
    await $fetch(`/api/keys/${id}`, { method: "DELETE" });
    toast.add({ title: "API key revoked" });
    await refresh();
  } catch (e: any) {
    toast.add({
      title: "Failed to revoke key",
      description: e.data?.message || "Unknown error",
      color: "error",
    });
  } finally {
    revoking.value = null;
  }
}
</script>
