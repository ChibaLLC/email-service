<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Inbound email</h1>
      <p class="mt-1 text-sm text-gray-400">Configure mailbox ingestion and signed webhook delivery.</p>
    </div>
    <InboundEmailSettings />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "dashboard", middleware: ["auth"] });
</script>
