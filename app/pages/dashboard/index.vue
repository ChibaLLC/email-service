<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-white">Delivery at a glance</h1>
        <p class="mt-1 text-sm text-gray-400">Volume, delivery health, and the latest messages.</p>
      </div>
      <div class="flex gap-2">
        <UButton
          color="primary"
          variant="subtle"
          icon="i-material-symbols-light-mark-email-read-outline"
          :loading="sendingTestEmail"
          @click="sendTestEmail"
        >
          Send test
        </UButton>
        <UButton color="neutral" variant="ghost" icon="i-material-symbols-light-refresh" @click="refresh">
          Refresh
        </UButton>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatsCard label="Total Sent" :value="stats?.totals.sent ?? 0" icon="material-symbols-light:check-circle-outline" color="text-emerald-400" />
      <StatsCard label="Failed" :value="stats?.totals.failed ?? 0" icon="material-symbols-light:error-outline" color="text-red-400" />
      <StatsCard label="Queued" :value="stats?.totals.queued ?? 0" icon="material-symbols-light:schedule-outline" color="text-amber-400" />
      <StatsCard label="Success Rate" :value="`${stats?.successRate ?? 100}%`" icon="material-symbols-light:trending-up" color="text-lime-400" />
      <StatsCard label="Active Keys" :value="stats?.activeKeys ?? 0" icon="material-symbols-light:key-outline" color="text-sky-400" />
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <section class="rounded-xl bg-white/5 p-5 ring-1 ring-gray-800 lg:col-span-2">
        <h2 class="mb-3 text-sm font-medium text-gray-400">Email volume (30 days)</h2>
        <div class="h-64">
          <ClientOnly><VChart :option="lineChartOption" autoresize class="size-full" /></ClientOnly>
        </div>
      </section>
      <section class="rounded-xl bg-white/5 p-5 ring-1 ring-gray-800">
        <h2 class="mb-3 text-sm font-medium text-gray-400">Status breakdown</h2>
        <div class="h-64">
          <ClientOnly><VChart :option="pieChartOption" autoresize class="size-full" /></ClientOnly>
        </div>
      </section>
    </div>

    <section class="overflow-hidden rounded-xl bg-white/5 p-5 ring-1 ring-gray-800">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h2 class="font-medium">Recent emails</h2>
          <p class="text-sm text-gray-500">The ten latest delivery attempts.</p>
        </div>
        <UButton to="/dashboard/emails" color="neutral" variant="ghost" trailing-icon="i-material-symbols-light-arrow-forward">View all</UButton>
      </div>
      <div class="overflow-x-auto">
        <UTable :data="recentEmails" :columns="columns" class="min-w-3xl" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { DashboardStats, EmailRecord } from "~~/shared/types";
import type { TableColumn } from "@nuxt/ui";

definePageMeta({ layout: "dashboard", middleware: ["auth"] });

const toast = useToast();
const sendingTestEmail = ref(false);
const { data: stats, refresh: refreshStats } = await useFetch<DashboardStats>("/api/dashboard/stats");
const { data: recentEmails, refresh: refreshRecent } = await useFetch<EmailRecord[]>("/api/dashboard/recent", {
  query: { limit: 10, offset: 0 },
  default: () => [],
});

const columns: TableColumn<EmailRecord>[] = [
  { accessorKey: "to", header: "To" },
  { accessorKey: "subject", header: "Subject" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "provider", header: "Provider" },
  { accessorKey: "queuedAt", header: "Queued" },
];

async function refresh() {
  await Promise.all([refreshStats(), refreshRecent()]);
  toast.add({ title: "Dashboard refreshed" });
}

async function sendTestEmail() {
  sendingTestEmail.value = true;
  try {
    const result = await $fetch<{ message: string; provider: string }>("/api/dashboard/test-email", { method: "POST" });
    await Promise.all([refreshStats(), refreshRecent()]);
    toast.add({ title: "Test email queued", description: `${result.message} via ${result.provider}.` });
  } catch (error: any) {
    toast.add({ title: "Failed to queue test email", description: error.data?.message || "The request was rejected.", color: "error" });
  } finally {
    sendingTestEmail.value = false;
  }
}

let refreshInterval: ReturnType<typeof setInterval> | undefined;
onMounted(() => { refreshInterval = setInterval(() => void Promise.all([refreshStats(), refreshRecent()]), 30000); });
onUnmounted(() => { if (refreshInterval) clearInterval(refreshInterval); });

const lineChartOption = computed(() => ({
  backgroundColor: "transparent",
  tooltip: { trigger: "axis" },
  grid: { left: 40, right: 16, top: 16, bottom: 30 },
  xAxis: { type: "category", data: stats.value?.dailyCounts.map((item) => item.date) || [], axisLabel: { color: "#6b7280", fontSize: 10 }, axisLine: { lineStyle: { color: "#374151" } } },
  yAxis: { type: "value", axisLabel: { color: "#6b7280" }, splitLine: { lineStyle: { color: "#1f2937" } } },
  series: [
    { name: "Sent", type: "line", smooth: true, data: stats.value?.dailyCounts.map((item) => Number(item.sent)) || [], lineStyle: { color: "#a3e635", width: 2 }, itemStyle: { color: "#a3e635" }, areaStyle: { color: "rgba(163,230,53,.12)" } },
    { name: "Failed", type: "line", smooth: true, data: stats.value?.dailyCounts.map((item) => Number(item.failed)) || [], lineStyle: { color: "#f87171", width: 2 }, itemStyle: { color: "#f87171" } },
  ],
}));

const pieChartOption = computed(() => ({
  backgroundColor: "transparent",
  tooltip: { trigger: "item" },
  series: [{
    type: "pie",
    radius: ["52%", "76%"],
    label: { show: false },
    data: [
      { value: stats.value?.totals.sent ?? 0, name: "Sent", itemStyle: { color: "#a3e635" } },
      { value: stats.value?.totals.failed ?? 0, name: "Failed", itemStyle: { color: "#f87171" } },
      { value: stats.value?.totals.queued ?? 0, name: "Queued", itemStyle: { color: "#fbbf24" } },
      { value: stats.value?.totals.sending ?? 0, name: "Sending", itemStyle: { color: "#38bdf8" } },
    ].filter((item) => item.value > 0),
  }],
}));
</script>
