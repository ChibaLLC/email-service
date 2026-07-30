<template>
  <div class="space-y-6">
    <div class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">API keys</h1>
        <p class="mt-1 text-sm text-gray-400">Review issued credentials and revoke access.</p>
      </div>
      <UBadge color="primary" variant="subtle">{{ keys.length }} keys</UBadge>
    </div>

    <section class="overflow-hidden rounded-xl bg-white/5 ring-1 ring-gray-800">
      <div v-if="keys.length" class="divide-y divide-gray-800">
        <div v-for="key in keys" :key="key.id" class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <code class="text-sm text-gray-200">{{ key.keyPrefix }}</code>
              <span v-if="key.name" class="text-sm text-gray-400">{{ key.name }}</span>
              <UBadge :color="key.active ? 'success' : 'error'" variant="subtle" size="xs">{{ key.active ? "Active" : "Revoked" }}</UBadge>
            </div>
            <p class="mt-1 text-xs text-gray-500">
              {{ key.email }} · Created {{ formatDate(key.createdAt) }}<span v-if="key.lastUsedAt"> · Last used {{ formatDate(key.lastUsedAt) }}</span>
            </p>
          </div>
          <UButton v-if="key.active" color="error" variant="ghost" icon="i-material-symbols-light-delete-outline" :loading="revoking === key.id" @click="revokeKey(key.id)">Revoke</UButton>
        </div>
      </div>
      <div v-else class="py-16 text-center text-gray-500">
        <UIcon name="i-material-symbols-light-key-off-outline" class="mx-auto mb-2 size-10 opacity-50" />
        <p>No API keys found</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { ApiKeyInfo } from "~~/shared/types";

definePageMeta({ layout: "dashboard", middleware: ["auth"] });

const toast = useToast();
const revoking = ref<string | null>(null);
const { data: keys, refresh } = await useFetch<ApiKeyInfo[]>("/api/keys", { default: () => [] });

function formatDate(value: string) { return new Date(value).toLocaleDateString(); }
async function revokeKey(id: string) {
  revoking.value = id;
  try {
    await $fetch(`/api/keys/${id}`, { method: "DELETE" });
    await refresh();
    toast.add({ title: "API key revoked" });
  } catch (error: any) {
    toast.add({ title: "Failed to revoke key", description: error.data?.message || "Unknown error", color: "error" });
  } finally {
    revoking.value = null;
  }
}
</script>
