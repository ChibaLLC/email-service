<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Outbound email</h1>
        <p class="mt-1 text-sm text-gray-400">Choose the delivery provider and manage its encrypted credentials.</p>
      </div>
      <div class="flex gap-2">
        <UButton color="neutral" variant="soft" icon="i-material-symbols-light-cable" :loading="testing" :disabled="!settings?.configured" @click="testConnection">Test connection</UButton>
        <UButton color="neutral" variant="soft" icon="i-material-symbols-light-send" :loading="sending" :disabled="!settings?.configured" @click="sendTest">Send test to me</UButton>
      </div>
    </div>

    <UAlert v-if="loadError" color="error" variant="subtle" title="Provider settings unavailable" :description="loadError.data?.message || 'The server could not load outbound settings.'" />

    <section v-else class="overflow-hidden rounded-xl bg-white/5 ring-1 ring-gray-800">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 p-5">
        <div class="flex items-center gap-3">
          <span class="flex size-10 items-center justify-center rounded-lg bg-lime-400/10 ring-1 ring-lime-400/20">
            <Icon :name="selectedProvider.icon" class="size-6 text-lime-400" />
          </span>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="font-medium">Active delivery provider</h2>
              <UBadge :color="settings?.configured ? 'success' : 'warning'" variant="subtle">{{ settings?.configured ? `Version ${settings.active?.version}` : "Setup required" }}</UBadge>
            </div>
            <p class="mt-1 text-sm text-gray-500">Settings are stored in the database. Secrets are encrypted and never returned.</p>
          </div>
        </div>
        <UBadge color="neutral" variant="subtle">Database managed</UBadge>
      </div>

      <form class="space-y-6 p-5" @submit.prevent="save">
        <fieldset>
          <legend class="mb-3 text-sm font-medium">Provider</legend>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label v-for="provider in providers" :key="provider.value" class="cursor-pointer rounded-lg border p-4 transition" :class="form.provider === provider.value ? 'border-lime-500/60 bg-lime-500/5' : 'border-gray-800 bg-gray-950/30 hover:border-gray-700'">
              <input v-model="form.provider" type="radio" :value="provider.value" class="sr-only" />
              <Icon :name="provider.icon" class="size-6" :class="form.provider === provider.value ? 'text-lime-400' : 'text-gray-500'" />
              <span class="mt-3 block text-sm font-medium">{{ provider.label }}</span>
              <span class="mt-1 block text-xs text-gray-500">{{ provider.description }}</span>
            </label>
          </div>
        </fieldset>

        <div class="grid gap-4 md:grid-cols-2">
          <UFormField label="Default sender" :hint="form.provider === 'resend' ? 'Optional; defaults to onboarding@resend.dev' : undefined" class="md:col-span-2">
            <UInput v-model="form.defaultFrom" type="email" class="w-full" placeholder="noreply@example.com" />
          </UFormField>

          <template v-if="form.provider === 'nodemailer'">
            <UFormField label="SMTP host"><UInput v-model="form.host" class="w-full" placeholder="smtp.example.com" /></UFormField>
            <UFormField label="SMTP port"><UInput v-model.number="form.port" type="number" min="1" max="65535" class="w-full" /></UFormField>
            <UFormField label="SMTP username"><UInput v-model="form.username" class="w-full" autocomplete="username" /></UFormField>
            <UFormField label="SMTP password"><UInput v-model="form.password" type="password" class="w-full" autocomplete="new-password" :placeholder="activeSecretConfigured ? 'Leave blank to keep current password' : 'Required'" /></UFormField>
          </template>

          <template v-else-if="form.provider === 'postal'">
            <UFormField label="Postal API URL" class="md:col-span-2"><UInput v-model="form.apiUrl" type="url" class="w-full font-mono text-sm" placeholder="https://postal.example.com" /></UFormField>
            <UFormField label="Server API key" class="md:col-span-2"><UInput v-model="form.serverApiKey" type="password" class="w-full" autocomplete="new-password" :placeholder="activeSecretConfigured ? 'Leave blank to keep current key' : 'Required'" /></UFormField>
          </template>

          <UFormField v-else :label="`${selectedProvider.label} API key`" class="md:col-span-2">
            <UInput v-model="form.apiKey" type="password" class="w-full" autocomplete="new-password" :placeholder="activeSecretConfigured ? 'Leave blank to keep current key' : 'Required'" />
          </UFormField>
        </div>

        <div class="flex flex-col gap-3 border-t border-gray-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-xs text-gray-500">New emails use the new revision immediately. Already queued emails remain pinned to their original revision.</p>
          <UButton type="submit" icon="i-material-symbols-light-save-outline" :loading="saving">Save and activate</UButton>
        </div>
      </form>
    </section>

    <section v-if="settings?.active" class="rounded-xl bg-white/5 p-5 ring-1 ring-gray-800">
      <h2 class="font-medium">Revision details</h2>
      <dl class="mt-4 grid gap-4 text-sm sm:grid-cols-3">
        <div><dt class="text-gray-500">Provider</dt><dd class="mt-1 capitalize text-gray-200">{{ settings.active.provider }}</dd></div>
        <div><dt class="text-gray-500">Activated by</dt><dd class="mt-1 text-gray-200">{{ settings.active.createdBy }}</dd></div>
        <div><dt class="text-gray-500">Activated</dt><dd class="mt-1 text-gray-200">{{ new Date(settings.active.createdAt).toLocaleString() }}</dd></div>
      </dl>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { OutboundProviderName, OutboundSettingsInput, OutboundSettingsView } from "~~/shared/types";

definePageMeta({ layout: "dashboard", middleware: ["auth"] });

const providers: { value: OutboundProviderName; label: string; description: string; icon: string }[] = [
  { value: "nodemailer", label: "SMTP", description: "Any SMTP server", icon: "material-symbols-light:alternate-email" },
  { value: "resend", label: "Resend", description: "Resend API", icon: "material-symbols-light:forward-to-inbox-outline" },
  { value: "sendgrid", label: "SendGrid", description: "Twilio SendGrid", icon: "material-symbols-light:send-outline" },
  { value: "mailchimp", label: "Mailchimp", description: "Transactional API", icon: "material-symbols-light:mark-email-read-outline" },
  { value: "postal", label: "Postal", description: "Self-hosted API", icon: "material-symbols-light:local-post-office-outline" },
];
const toast = useToast();
const saving = ref(false);
const testing = ref(false);
const sending = ref(false);
const form = reactive({ provider: "nodemailer" as OutboundProviderName, defaultFrom: "", host: "", port: 587, username: "", password: "", apiKey: "", apiUrl: "", serverApiKey: "" });
const { data: settings, error: loadError, refresh } = await useFetch<OutboundSettingsView>("/api/dashboard/settings/outbound");

const selectedProvider = computed(() => providers.find((provider) => provider.value === form.provider)!);
const activeSecretConfigured = computed(() => {
  if (settings.value?.active?.provider !== form.provider) return false;
  const config = settings.value.active.config;
  return Boolean(config.hasPassword || config.hasApiKey || config.hasServerApiKey);
});

watch(settings, (value) => {
  const active = value?.active;
  if (!active) return;
  Object.assign(form, {
    provider: active.provider,
    defaultFrom: String(active.config.defaultFrom || ""),
    host: String(active.config.host || ""),
    port: Number(active.config.port || 587),
    username: String(active.config.username || ""),
    password: "",
    apiKey: "",
    apiUrl: String(active.config.apiUrl || ""),
    serverApiKey: "",
  });
}, { immediate: true });

function requestBody(): OutboundSettingsInput {
  if (form.provider === "nodemailer") return { provider: form.provider, defaultFrom: form.defaultFrom, host: form.host, port: form.port, username: form.username, password: form.password || undefined };
  if (form.provider === "postal") return { provider: form.provider, defaultFrom: form.defaultFrom, apiUrl: form.apiUrl, serverApiKey: form.serverApiKey || undefined };
  if (form.provider === "resend") return { provider: form.provider, defaultFrom: form.defaultFrom || undefined, apiKey: form.apiKey || undefined };
  return { provider: form.provider, defaultFrom: form.defaultFrom, apiKey: form.apiKey || undefined };
}
function errorMessage(error: any, fallback: string) { return error.data?.message || error.message || fallback; }
async function save() {
  saving.value = true;
  try {
    await $fetch("/api/dashboard/settings/outbound", { method: "PUT", body: requestBody() });
    form.password = ""; form.apiKey = ""; form.serverApiKey = "";
    await refresh();
    toast.add({ title: "Outbound provider activated", description: `${selectedProvider.value.label} is now used for new email.`, icon: "i-material-symbols-light-check-circle-outline" });
  } catch (error: any) { toast.add({ title: "Could not activate provider", description: errorMessage(error, "Check the provider settings."), color: "error" }); }
  finally { saving.value = false; }
}
async function testConnection() {
  testing.value = true;
  try { await $fetch("/api/dashboard/settings/outbound/test", { method: "POST" }); toast.add({ title: "Provider connection succeeded", icon: "i-material-symbols-light-check-circle-outline" }); }
  catch (error: any) { toast.add({ title: "Provider connection failed", description: errorMessage(error, "The provider could not be verified."), color: "error" }); }
  finally { testing.value = false; }
}
async function sendTest() {
  sending.value = true;
  try { const result = await $fetch<{ email: string }>("/api/dashboard/test-email", { method: "POST" }); toast.add({ title: "Test email queued", description: `Sending through the active provider to ${result.email}.`, icon: "i-material-symbols-light-check-circle-outline" }); }
  catch (error: any) { toast.add({ title: "Could not queue test email", description: errorMessage(error, "Try again."), color: "error" }); }
  finally { sending.value = false; }
}
</script>
