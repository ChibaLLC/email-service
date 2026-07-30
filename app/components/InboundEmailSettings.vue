<template>
  <section class="overflow-hidden rounded-xl bg-white/5 ring-1 ring-gray-800">
    <div class="flex flex-col gap-4 border-b border-gray-800 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="flex items-center gap-2">
          <UIcon name="i-material-symbols-light-move-to-inbox-outline" class="h-5 w-5 text-lime-400" />
          <h2 class="font-semibold">Inbound IMAP</h2>
          <UBadge :color="config?.enabled ? 'success' : 'neutral'" variant="subtle">{{ config?.enabled ? "Enabled" : "Disabled" }}</UBadge>
        </div>
        <p class="mt-1 text-sm text-gray-400">Poll one mailbox and route encrypted MIME through signed, retryable webhooks.</p>
      </div>
      <div class="flex gap-2">
        <UButton variant="soft" color="neutral" icon="i-material-symbols-light-refresh" :loading="status === 'pending'" @click="() => refresh()">Refresh</UButton>
        <UButton v-if="config?.enabled" variant="soft" color="primary" icon="i-material-symbols-light-cable" :loading="testingImap" @click="testConnection">Test IMAP</UButton>
      </div>
    </div>

    <div v-if="error" class="p-5 text-sm text-gray-400">Inbound settings are available only to configured dashboard administrators.</div>
    <div v-else-if="config" class="p-5">
      <div class="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-lg bg-gray-950/60 p-3"><div class="text-xs uppercase tracking-wide text-gray-500">Last success</div><div class="mt-1 text-sm font-medium">{{ formatDate(config.status.lastSuccessAt) }}</div></div>
        <div class="rounded-lg bg-gray-950/60 p-3"><div class="text-xs uppercase tracking-wide text-gray-500">Mailbox UID</div><div class="mt-1 font-mono text-sm font-medium">{{ config.status.lastUid || "-" }}</div></div>
        <div class="rounded-lg bg-gray-950/60 p-3"><div class="text-xs uppercase tracking-wide text-gray-500">Pending deliveries</div><div class="mt-1 font-medium">{{ config.status.pendingDeliveries }}</div></div>
        <div class="rounded-lg bg-gray-950/60 p-3"><div class="text-xs uppercase tracking-wide text-gray-500">Failed deliveries</div><div class="mt-1 font-medium" :class="config.status.failedDeliveries ? 'text-red-400' : ''">{{ config.status.failedDeliveries }}</div></div>
      </div>
      <div v-if="config.status.lastError" class="mb-5 rounded-lg border border-red-900/70 bg-red-950/40 p-3 text-sm text-red-200">{{ config.status.lastError }}</div>

      <form class="space-y-5" @submit.prevent="save">
        <div class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950/30 p-4"><div><div class="font-medium">Mailbox ingestion</div><div class="text-sm text-gray-500">Disabled configurations do not open IMAP or send webhooks.</div></div><USwitch v-model="form.enabled" /></div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UFormField label="IMAP host" class="lg:col-span-2"><UInput v-model="form.host" class="w-full" placeholder="mail.example.com" /></UFormField>
          <UFormField label="Port"><UInput v-model.number="form.port" type="number" class="w-full" /></UFormField>
          <UFormField label="Poll interval (seconds)"><UInput v-model.number="form.pollIntervalSeconds" type="number" min="10" max="3600" class="w-full" /></UFormField>
          <UFormField label="Username" class="lg:col-span-2"><UInput v-model="form.username" class="w-full" autocomplete="username" /></UFormField>
          <UFormField label="Password" class="lg:col-span-2"><UInput v-model="form.password" type="password" class="w-full" autocomplete="new-password" :placeholder="config.hasPassword ? 'Leave blank to keep current password' : 'Required when enabled'" /></UFormField>
          <UFormField label="Mailbox" class="lg:col-span-2"><UInput v-model="form.mailbox" class="w-full" placeholder="INBOX" /></UFormField>
          <div class="flex items-end lg:col-span-2"><label class="flex h-10 items-center gap-3 text-sm text-gray-300"><USwitch v-model="form.secure" />Implicit TLS (normally port 993)</label></div>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between"><div><div class="font-medium">Webhook destinations</div><div class="text-sm text-gray-500">Leave sender filters empty to receive every sender. Use an address or a domain such as <code>@gmail.com</code>.</div></div><UButton size="sm" variant="soft" icon="i-material-symbols-light-add" @click="addWebhook">Add webhook</UButton></div>
          <div v-for="(webhook, index) in form.webhooks" :key="webhook.key" class="rounded-lg border border-gray-800 bg-gray-950/30 p-4">
            <div class="mb-3 flex items-center justify-between gap-3"><span class="text-sm font-medium">Destination {{ index + 1 }}</span><div class="flex gap-2"><UButton v-if="webhook.id" size="xs" variant="soft" color="primary" :loading="testingWebhook === webhook.id" @click="testWebhook(webhook.id)">Test webhook</UButton><UButton size="xs" variant="ghost" color="error" icon="i-material-symbols-light-delete-outline" :disabled="form.webhooks.length === 1" @click="() => { form.webhooks.splice(index, 1); }" /></div></div>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Name"><UInput v-model="webhook.name" class="w-full" placeholder="Calendar agent" /></UFormField>
              <UFormField label="Sender filters"><UInput v-model="webhook.senderFilters" class="w-full" placeholder="calendar-notification@google.com, @gmail.com" /></UFormField>
              <UFormField label="Webhook URL" class="sm:col-span-2"><UInput v-model="webhook.url" type="url" class="w-full font-mono text-sm" placeholder="https://app.example.com/api/inbound" /></UFormField>
              <UFormField label="Webhook secret" class="sm:col-span-2"><UInput v-model="webhook.secret" type="password" class="w-full" autocomplete="new-password" :placeholder="webhook.hasSecret ? 'Leave blank to keep current secret' : 'At least 32 characters'" /></UFormField>
            </div>
          </div>
        </div>
        <div class="flex justify-end"><UButton type="submit" icon="i-material-symbols-light-save-outline" :loading="saving">Save inbound settings</UButton></div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { InboundEmailConfigView } from "~~/shared/types";

type FormWebhook = { key: string; id?: string; name: string; url: string; secret: string; hasSecret: boolean; senderFilters: string };
const toast = useToast();
const saving = ref(false);
const testingImap = ref(false);
const testingWebhook = ref<string>();
const form = reactive({ enabled: false, host: "", port: 993, secure: true, username: "", password: "", mailbox: "INBOX", webhooks: [] as FormWebhook[], pollIntervalSeconds: 30 });
const { data: config, error, status, refresh } = await useFetch<InboundEmailConfigView>("/api/dashboard/inbound");

function newWebhook(): FormWebhook { return { key: crypto.randomUUID(), name: "", url: "", secret: "", hasSecret: false, senderFilters: "" }; }
function addWebhook() { form.webhooks.push(newWebhook()); }
watch(config, (value) => {
  if (!value) return;
  Object.assign(form, { enabled: value.enabled, host: value.host, port: value.port, secure: value.secure, username: value.username, password: "", mailbox: value.mailbox, pollIntervalSeconds: value.pollIntervalSeconds, webhooks: value.webhooks.map((webhook) => ({ key: webhook.id, id: webhook.id, name: webhook.name, url: webhook.url, secret: "", hasSecret: webhook.hasSecret, senderFilters: webhook.senderFilters.join(", ") })) });
  if (form.webhooks.length === 0) addWebhook();
}, { immediate: true });

function formatDate(value: string | null) { return value ? new Date(value).toLocaleString() : "Never"; }
async function save() {
  saving.value = true;
  try {
    await $fetch("/api/dashboard/inbound", { method: "PUT", body: { ...form, webhooks: form.webhooks.map(({ id, name, url, secret, senderFilters }) => ({ id, name, url, secret: secret || undefined, senderFilters: senderFilters.split(",").map((filter) => filter.trim()).filter(Boolean) })) } });
    await refresh();
    toast.add({ title: "Inbound settings saved", icon: "i-material-symbols-light-check-circle-outline" });
  } catch (error: any) { toast.add({ title: "Could not save inbound settings", description: error.data?.message || "Check the configuration and try again.", color: "error" }); }
  finally { saving.value = false; }
}
async function testConnection() {
  testingImap.value = true;
  try { const result = await $fetch<{ mailbox: string; messages: number }>("/api/dashboard/inbound/test", { method: "POST" }); toast.add({ title: "IMAP connection succeeded", description: `${result.mailbox} contains ${result.messages} messages.`, icon: "i-material-symbols-light-check-circle-outline" }); }
  catch (error: any) { toast.add({ title: "IMAP connection failed", description: error.data?.message || "The mailbox could not be reached.", color: "error" }); }
  finally { testingImap.value = false; }
}
async function testWebhook(id: string) {
  testingWebhook.value = id;
  try { await $fetch(`/api/dashboard/inbound/webhooks/${id}/test`, { method: "POST" }); toast.add({ title: "Webhook test succeeded", description: "The destination accepted a signed test event.", icon: "i-material-symbols-light-check-circle-outline" }); }
  catch (error: any) { toast.add({ title: "Webhook test failed", description: error.data?.message || "The destination could not be reached.", color: "error" }); }
  finally { testingWebhook.value = undefined; }
}
</script>
