<template>
  <div class="rounded-xl bg-white/5 ring-1 ring-gray-800 p-4 flex items-center gap-4">
    <div class="rounded-lg bg-white/5 p-3">
      <UIcon :name="icon" :class="['w-6 h-6', color]" />
    </div>
    <div>
      <div class="text-2xl font-bold text-white">{{ value }}</div>
      <div class="text-xs text-gray-500 uppercase tracking-wide">{{ label }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  icon: string;
  color: string;
}>();
</script>
