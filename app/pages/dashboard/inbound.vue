<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Inbound email</h1>
      <p class="mt-1 text-sm text-gray-400">Route mail from multiple accounts and inboxes to private, signed webhook destinations.</p>
    </div>
    <InboundEmailSettings />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "dashboard", middleware: ["auth"] });
</script>
