<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <!-- Header -->
    <header class="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <div class="flex items-center gap-3">
          <UIcon name="i-material-symbols-light-mail-outline" class="w-7 h-7 text-lime-400" />
          <h1 class="text-lg font-bold">Email Service</h1>
        </div>
        <div class="flex items-center gap-3">
          <UButton
            color="primary"
            variant="subtle"
            icon="i-material-symbols-light-mark-email-read-outline"
            :loading="sendingTestEmail"
            @click="sendTestEmail"
          >
            Send Test Email
          </UButton>
          <UButton to="/dashboard/listmonk" variant="ghost" color="neutral" icon="i-material-symbols-light-newsstand-outline">
            Listmonk
          </UButton>
          <UButton to="/dashboard/keys" variant="ghost" color="neutral" icon="i-material-symbols-light-key-outline">
            API Keys
          </UButton>
          <UButton variant="ghost" color="neutral" @click="refresh">
            <UIcon name="i-material-symbols-light-refresh" class="w-5 h-5" />
          </UButton>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <!-- Stats Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          label="Total Sent"
          :value="stats?.totals?.sent ?? 0"
          icon="i-material-symbols-light-check-circle-outline"
          color="text-emerald-400"
        />
        <StatsCard
          label="Failed"
          :value="stats?.totals?.failed ?? 0"
          icon="i-material-symbols-light-error-outline"
          color="text-red-400"
        />
        <StatsCard
          label="Queued"
          :value="stats?.totals?.queued ?? 0"
          icon="i-material-symbols-light-schedule-outline"
          color="text-amber-400"
        />
        <StatsCard
          label="Success Rate"
          :value="`${stats?.successRate ?? 100}%`"
          icon="i-material-symbols-light-trending-up"
          color="text-lime-400"
        />
        <StatsCard
          label="Active Keys"
          :value="stats?.activeKeys ?? 0"
          icon="i-material-symbols-light-key-outline"
          color="text-sky-400"
        />
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Email Volume Chart (line) -->
        <div class="lg:col-span-2 rounded-xl bg-white/5 ring-1 ring-gray-800 p-5">
          <h3 class="text-sm font-medium text-gray-400 mb-4">Email Volume (30 days)</h3>
          <div class="h-72">
            <ClientOnly>
              <VChart :option="lineChartOption" autoresize style="width: 100%; height: 100%" />
            </ClientOnly>
          </div>
        </div>

        <!-- Status Breakdown (pie) -->
        <div class="rounded-xl bg-white/5 ring-1 ring-gray-800 p-5">
          <h3 class="text-sm font-medium text-gray-400 mb-4">Status Breakdown</h3>
          <div class="h-72">
            <ClientOnly>
              <VChart :option="pieChartOption" autoresize style="width: 100%; height: 100%" />
            </ClientOnly>
          </div>
        </div>
      </div>

      <!-- Queue Health + Recent Emails -->
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <!-- Queue Health -->
        <div class="rounded-xl bg-white/5 ring-1 ring-gray-800 p-5 flex flex-col">
          <h3 class="text-sm font-medium text-gray-400 mb-4">Queue Health</h3>
          <div class="h-48 shrink-0">
            <ClientOnly>
              <VChart :option="gaugeChartOption" autoresize style="width: 100%; height: 100%" />
            </ClientOnly>
          </div>
          <div class="grid grid-cols-4 gap-2 mt-auto pt-3 border-t border-gray-800/50 text-xs">
            <div class="text-center">
              <div class="text-gray-500">Active</div>
              <div class="text-white font-semibold">{{ queue?.active ?? 0 }}</div>
            </div>
            <div class="text-center">
              <div class="text-gray-500">Waiting</div>
              <div class="text-white font-semibold">{{ queue?.waiting ?? 0 }}</div>
            </div>
            <div class="text-center">
              <div class="text-gray-500">Completed</div>
              <div class="text-white font-semibold">{{ queue?.completed ?? 0 }}</div>
            </div>
            <div class="text-center">
              <div class="text-gray-500">Failed</div>
              <div class="text-white font-semibold">{{ queue?.failed ?? 0 }}</div>
            </div>
          </div>
        </div>

        <!-- Recent Emails Table -->
        <div class="lg:col-span-3 rounded-xl bg-white/5 ring-1 ring-gray-800 p-5 overflow-hidden">
          <h3 class="text-sm font-medium text-gray-400 mb-4">Recent Emails</h3>
          <div class="overflow-x-auto">
            <UTable :data="recentEmails" :columns="columns" class="w-full" />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { DashboardStats, QueueStats, EmailRecord } from "~~/shared/types";
import type { TableColumn } from "@nuxt/ui";

definePageMeta({ layout: false, middleware: ["auth"] });

const toast = useToast();
const sendingTestEmail = ref(false);

// Fetch data
const { data: stats, refresh: refreshStats } = await useFetch<DashboardStats>("/api/dashboard/stats", {
  default: () => ({
    totals: { sent: 0, failed: 0, queued: 0, sending: 0, total: 0 },
    sentToday: 0,
    sentThisWeek: 0,
    activeKeys: 0,
    dailyCounts: [] as { date: string; sent: number; failed: number; total: number }[],
    successRate: 100,
  }),
});

const { data: queue, refresh: refreshQueue } = await useFetch<QueueStats>("/api/dashboard/queue", {
  default: () => ({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0 }),
});

const { data: recentEmails, refresh: refreshRecent } = await useFetch<any[]>("/api/dashboard/recent", {
  default: () => [],
});

async function refresh() {
  await Promise.all([refreshStats(), refreshQueue(), refreshRecent()]);
  toast.add({ title: "Dashboard refreshed" });
}

async function sendTestEmail() {
  sendingTestEmail.value = true;

  try {
    const result = await $fetch<{ message: string; provider: string; email: string }>("/api/dashboard/test-email", {
      method: "POST",
    });

    await Promise.all([refreshStats(), refreshQueue(), refreshRecent()]);
    toast.add({
      title: "Test email queued",
      description: `${result.message} via ${result.provider}.`,
      icon: "i-material-symbols-light-mark-email-read-outline",
    });
  } catch (error: any) {
    toast.add({
      title: "Failed to queue test email",
      description: error.data?.message || "The email service rejected the test email request.",
      color: "error",
    });
  } finally {
    sendingTestEmail.value = false;
  }
}

// Auto-refresh every 30s
const refreshInterval = ref<ReturnType<typeof setInterval>>();
onMounted(() => {
  refreshInterval.value = setInterval(refresh, 30000);
});
onUnmounted(() => {
  if (refreshInterval.value) clearInterval(refreshInterval.value);
});

// Table columns
const columns: TableColumn<EmailRecord>[] = [
  { accessorKey: "to", header: "To" },
  { accessorKey: "subject", header: "Subject" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "provider", header: "Provider" },
  { accessorKey: "queuedAt", header: "Queued" },
];

// Line Chart — Email volume
const lineChartOption = computed(() => {
  const dailyData = (stats.value?.dailyCounts as any[]) || [];
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: "category",
      data: dailyData.map((d: any) => d.date),
      axisLabel: { color: "#6b7280", fontSize: 10 },
      axisLine: { lineStyle: { color: "#374151" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#6b7280" },
      splitLine: { lineStyle: { color: "#1f2937" } },
    },
    series: [
      {
        name: "Sent",
        type: "line",
        smooth: true,
        data: dailyData.map((d: any) => Number(d.sent)),
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(163, 230, 53, 0.3)" },
              { offset: 1, color: "rgba(163, 230, 53, 0)" },
            ],
          },
        },
        lineStyle: { color: "#a3e635", width: 2 },
        itemStyle: { color: "#a3e635" },
      },
      {
        name: "Failed",
        type: "line",
        smooth: true,
        data: dailyData.map((d: any) => Number(d.failed)),
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(248, 113, 113, 0.3)" },
              { offset: 1, color: "rgba(248, 113, 113, 0)" },
            ],
          },
        },
        lineStyle: { color: "#f87171", width: 2 },
        itemStyle: { color: "#f87171" },
      },
    ],
  };
});

// Pie Chart — Status breakdown
const pieChartOption = computed(() => ({
  backgroundColor: "transparent",
  tooltip: { trigger: "item" },
  series: [
    {
      type: "pie",
      radius: ["50%", "75%"],
      avoidLabelOverlap: false,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold", color: "#fff" } },
      data: [
        { value: stats.value?.totals?.sent ?? 0, name: "Sent", itemStyle: { color: "#a3e635" } },
        { value: stats.value?.totals?.failed ?? 0, name: "Failed", itemStyle: { color: "#f87171" } },
        { value: stats.value?.totals?.queued ?? 0, name: "Queued", itemStyle: { color: "#fbbf24" } },
        { value: stats.value?.totals?.sending ?? 0, name: "Sending", itemStyle: { color: "#38bdf8" } },
      ].filter((d) => d.value > 0),
    },
  ],
}));

// Gauge Chart — Queue depth
const gaugeChartOption = computed(() => ({
  backgroundColor: "transparent",
  series: [
    {
      type: "gauge",
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: Math.max((queue.value?.total ?? 0) + 10, 50),
      pointer: { show: false },
      progress: {
        show: true,
        width: 12,
        roundCap: true,
        itemStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: "#a3e635" },
              { offset: 1, color: "#fbbf24" },
            ],
          },
        },
      },
      axisLine: { lineStyle: { width: 12, color: [[1, "#1f2937"]] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: {
        valueAnimation: true,
        fontSize: 24,
        fontWeight: "bold",
        color: "#fff",
        offsetCenter: [0, "10%"],
      },
      data: [{ value: queue.value?.total ?? 0, name: "In Queue" }],
      title: { fontSize: 11, color: "#6b7280", offsetCenter: [0, "40%"] },
    },
  ],
}));
</script>
