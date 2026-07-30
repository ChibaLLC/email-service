<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Integrations</h1>
      <p class="mt-1 text-sm text-gray-400">Manage services connected to email delivery and ingestion.</p>
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <NuxtLink to="/dashboard/listmonk" class="group rounded-xl bg-white/5 p-6 ring-1 ring-gray-800 transition hover:bg-white/[.07] hover:ring-gray-700">
        <div class="flex items-start justify-between gap-4">
          <span class="rounded-lg bg-lime-400/10 p-3"><UIcon name="i-material-symbols-light-newsstand-outline" class="size-7 text-lime-400" /></span>
          <UIcon name="i-material-symbols-light-arrow-forward" class="size-5 text-gray-500 transition group-hover:translate-x-1 group-hover:text-gray-300" />
        </div>
        <h2 class="mt-5 text-lg font-semibold">Listmonk</h2>
        <p class="mt-2 text-sm leading-6 text-gray-400">Configure the server-side connection and inspect campaigns, lists, and subscribers.</p>
      </NuxtLink>
      <NuxtLink to="/dashboard/inbound" class="group rounded-xl bg-white/5 p-6 ring-1 ring-gray-800 transition hover:bg-white/[.07] hover:ring-gray-700">
        <div class="flex items-start justify-between gap-4">
          <span class="rounded-lg bg-sky-400/10 p-3"><UIcon name="i-material-symbols-light-move-to-inbox-outline" class="size-7 text-sky-400" /></span>
          <UIcon name="i-material-symbols-light-arrow-forward" class="size-5 text-gray-500 transition group-hover:translate-x-1 group-hover:text-gray-300" />
        </div>
        <h2 class="mt-5 text-lg font-semibold">Inbound IMAP</h2>
        <p class="mt-2 text-sm leading-6 text-gray-400">Poll a mailbox and forward encrypted MIME messages to signed webhooks.</p>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "dashboard", middleware: ["auth"] });
</script>
