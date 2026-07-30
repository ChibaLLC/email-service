<template>
  <div class="space-y-6">
    <div class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">Queue health</h1>
        <p class="mt-1 text-sm text-gray-400">Current BullMQ workload and processed job counts.</p>
      </div>
      <UButton color="neutral" variant="soft" icon="i-material-symbols-light-refresh" :loading="status === 'pending'" @click="() => refresh()">Refresh</UButton>
    </div>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatsCard label="Waiting" :value="queue?.waiting ?? 0" icon="i-material-symbols-light-hourglass-empty" color="text-amber-400" />
      <StatsCard label="Active" :value="queue?.active ?? 0" icon="i-material-symbols-light-play-circle-outline" color="text-sky-400" />
      <StatsCard label="Delayed" :value="queue?.delayed ?? 0" icon="i-material-symbols-light-schedule-outline" color="text-violet-400" />
      <StatsCard label="Completed" :value="queue?.completed ?? 0" icon="i-material-symbols-light-check-circle-outline" color="text-emerald-400" />
      <StatsCard label="Failed" :value="queue?.failed ?? 0" icon="i-material-symbols-light-error-outline" color="text-red-400" />
    </div>

    <section class="grid gap-6 rounded-xl bg-white/5 p-5 ring-1 ring-gray-800 md:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
      <div class="h-80">
        <ClientOnly><VChart :option="gaugeChartOption" autoresize class="size-full" /></ClientOnly>
      </div>
      <div class="flex flex-col justify-center space-y-4">
        <div>
          <p class="text-sm text-gray-500">Jobs requiring attention</p>
          <p class="mt-1 text-4xl font-semibold">{{ queue?.total ?? 0 }}</p>
        </div>
        <p class="text-sm leading-6 text-gray-400">Queue depth includes waiting, active, and delayed jobs. Completed and failed values are retained job totals.</p>
        <UBadge :color="queue?.failed ? 'warning' : 'success'" variant="subtle" class="w-fit">
          {{ queue?.failed ? `${queue.failed} failed jobs retained` : "No retained failures" }}
        </UBadge>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { QueueStats } from "~~/shared/types";

definePageMeta({ layout: "dashboard", middleware: ["auth"] });

const { data: queue, status, refresh } = await useFetch<QueueStats>("/api/dashboard/queue");
let refreshInterval: ReturnType<typeof setInterval> | undefined;
onMounted(() => { refreshInterval = setInterval(() => void refresh(), 15000); });
onUnmounted(() => { if (refreshInterval) clearInterval(refreshInterval); });

const gaugeChartOption = computed(() => ({
  backgroundColor: "transparent",
  series: [{
    type: "gauge",
    startAngle: 210,
    endAngle: -30,
    min: 0,
    max: Math.max((queue.value?.total ?? 0) + 10, 50),
    pointer: { show: false },
    progress: { show: true, width: 18, roundCap: true, itemStyle: { color: "#a3e635" } },
    axisLine: { lineStyle: { width: 18, color: [[1, "#1f2937"]] } },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: { show: false },
    detail: { valueAnimation: true, fontSize: 40, fontWeight: "bold", color: "#fff", offsetCenter: [0, "5%"] },
    title: { color: "#6b7280", offsetCenter: [0, "35%"] },
    data: [{ value: queue.value?.total ?? 0, name: "In queue" }],
  }],
}));
</script>
