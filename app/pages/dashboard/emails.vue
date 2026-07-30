<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Email history</h1>
        <p class="mt-1 text-sm text-gray-400">Browse delivery attempts in newest-first order.</p>
      </div>
      <UButton color="neutral" variant="soft" icon="i-material-symbols-light-refresh" :loading="status === 'pending'" @click="() => refresh()">Refresh</UButton>
    </div>

    <section class="overflow-hidden rounded-xl bg-white/5 ring-1 ring-gray-800">
      <div class="overflow-x-auto p-2 sm:p-4">
        <UTable :data="emails" :columns="columns" :loading="status === 'pending'" class="min-w-5xl">
          <template #status-cell="{ row }">
            <UBadge :color="statusColor(row.original.status)" variant="subtle" class="capitalize">{{ row.original.status }}</UBadge>
          </template>
          <template #queuedAt-cell="{ row }">{{ formatDate(row.original.queuedAt) }}</template>
          <template #sentAt-cell="{ row }">{{ formatDate(row.original.sentAt) }}</template>
        </UTable>
      </div>
      <div class="flex items-center justify-between border-t border-gray-800 px-4 py-3">
        <p class="text-sm text-gray-500">Showing {{ offset + 1 }}-{{ offset + emails.length }}</p>
        <div class="flex gap-2">
          <UButton color="neutral" variant="ghost" icon="i-material-symbols-light-chevron-left" :disabled="page === 1" @click="() => { page--; }">Previous</UButton>
          <UButton color="neutral" variant="ghost" trailing-icon="i-material-symbols-light-chevron-right" :disabled="emails.length < pageSize" @click="() => { page++; }">Next</UButton>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { EmailRecord } from "~~/shared/types";
import type { TableColumn } from "@nuxt/ui";

definePageMeta({ layout: "dashboard", middleware: ["auth"] });

const page = ref(1);
const pageSize = 25;
const offset = computed(() => (page.value - 1) * pageSize);
const { data: emails, status, refresh } = await useFetch<EmailRecord[]>("/api/dashboard/recent", {
  query: { limit: pageSize, offset },
  watch: [offset],
  default: () => [],
});

const columns: TableColumn<EmailRecord>[] = [
  { accessorKey: "from", header: "From" },
  { accessorKey: "to", header: "To" },
  { accessorKey: "subject", header: "Subject" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "provider", header: "Provider" },
  { accessorKey: "queuedAt", header: "Queued" },
  { accessorKey: "sentAt", header: "Sent" },
  { accessorKey: "error", header: "Error" },
];

function formatDate(value: string | null) { return value ? new Date(value).toLocaleString() : "-"; }
function statusColor(status: EmailRecord["status"]): "success" | "error" | "warning" | "info" {
  if (status === "sent") return "success";
  if (status === "failed") return "error";
  if (status === "queued") return "warning";
  return "info";
}
</script>
