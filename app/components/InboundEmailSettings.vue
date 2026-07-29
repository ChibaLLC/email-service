<template>
  <section class="rounded-xl bg-white/5 ring-1 ring-gray-800 overflow-hidden">
    <div class="flex flex-col gap-4 border-b border-gray-800 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="flex items-center gap-2">
          <UIcon name="i-material-symbols-light-move-to-inbox-outline" class="h-5 w-5 text-lime-400" />
          <h2 class="font-semibold">Inbound IMAP</h2>
          <UBadge :color="config?.enabled ? 'success' : 'neutral'" variant="subtle">
            {{ config?.enabled ? "Enabled" : "Disabled" }}
          </UBadge>
        </div>
        <p class="mt-1 text-sm text-gray-400">
          Poll one mailbox and forward encrypted MIME through signed, retryable webhooks.
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          variant="soft"
          color="neutral"
          icon="i-material-symbols-light-refresh"
          :loading="status === 'pending'"
          @click="() => refresh()"
        >
          Refresh
        </UButton>
        <UButton
          v-if="config?.enabled"
          variant="soft"
          color="primary"
          icon="i-material-symbols-light-cable"
          :loading="testing"
          @click="testConnection"
        >
          Test connection
        </UButton>
      </div>
    </div>

    <div v-if="error" class="p-5 text-sm text-gray-400">
      Inbound settings are available only to configured dashboard administrators.
    </div>
    <div v-else-if="config" class="p-5">
      <div class="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div class="rounded-lg bg-gray-950/60 p-3">
          <div class="text-xs uppercase tracking-wide text-gray-500">Source</div>
          <div class="mt-1 font-medium capitalize">{{ config.source }}</div>
        </div>
        <div class="rounded-lg bg-gray-950/60 p-3">
          <div class="text-xs uppercase tracking-wide text-gray-500">Last success</div>
          <div class="mt-1 text-sm font-medium">{{ formatDate(config.status.lastSuccessAt) }}</div>
        </div>
        <div class="rounded-lg bg-gray-950/60 p-3">
          <div class="text-xs uppercase tracking-wide text-gray-500">Mailbox UID</div>
          <div class="mt-1 font-mono text-sm font-medium">{{ config.status.lastUid || "-" }}</div>
        </div>
        <div class="rounded-lg bg-gray-950/60 p-3">
          <div class="text-xs uppercase tracking-wide text-gray-500">Pending webhooks</div>
          <div class="mt-1 font-medium">{{ config.status.pendingDeliveries }}</div>
        </div>
        <div class="rounded-lg bg-gray-950/60 p-3">
          <div class="text-xs uppercase tracking-wide text-gray-500">Failed webhooks</div>
          <div class="mt-1 font-medium" :class="config.status.failedDeliveries ? 'text-red-400' : ''">
            {{ config.status.failedDeliveries }}
          </div>
        </div>
      </div>

      <div
        v-if="config.status.lastError"
        class="mb-5 rounded-lg border border-red-900/70 bg-red-950/40 p-3 text-sm text-red-200"
      >
        {{ config.status.lastError }}
      </div>
      <div
        v-if="!config.editable"
        class="mb-5 rounded-lg border border-sky-900/70 bg-sky-950/30 p-3 text-sm text-sky-200"
      >
        Environment configuration is read-only. Set <code>INBOUND_CONFIG_SOURCE=database</code> to manage it here.
      </div>

      <form class="space-y-5" @submit.prevent="save">
        <div class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950/30 p-4">
          <div>
            <div class="font-medium">Mailbox ingestion</div>
            <div class="text-sm text-gray-500">Disabled configurations do not open IMAP or send webhooks.</div>
          </div>
          <USwitch v-model="form.enabled" :disabled="!config.editable" />
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UFormField label="IMAP host" class="lg:col-span-2">
            <UInput v-model="form.host" class="w-full" placeholder="mail.example.com" :disabled="!config.editable" />
          </UFormField>
          <UFormField label="Port">
            <UInput v-model.number="form.port" type="number" class="w-full" :disabled="!config.editable" />
          </UFormField>
          <UFormField label="Poll interval (seconds)">
            <UInput
              v-model.number="form.pollIntervalSeconds"
              type="number"
              min="10"
              max="3600"
              class="w-full"
              :disabled="!config.editable"
            />
          </UFormField>
          <UFormField label="Username" class="lg:col-span-2">
            <UInput v-model="form.username" class="w-full" autocomplete="username" :disabled="!config.editable" />
          </UFormField>
          <UFormField label="Password" class="lg:col-span-2">
            <UInput
              v-model="form.password"
              type="password"
              class="w-full"
              autocomplete="new-password"
              :placeholder="config.hasPassword ? 'Leave blank to keep current password' : 'Required when enabled'"
              :disabled="!config.editable"
            />
          </UFormField>
          <UFormField label="Mailbox" class="lg:col-span-2">
            <UInput v-model="form.mailbox" class="w-full" placeholder="INBOX" :disabled="!config.editable" />
          </UFormField>
          <div class="flex items-end lg:col-span-2">
            <label class="flex h-10 items-center gap-3 text-sm text-gray-300">
              <USwitch v-model="form.secure" :disabled="!config.editable" />
              Implicit TLS (normally port 993)
            </label>
          </div>
          <UFormField label="Webhook URL" class="sm:col-span-2 lg:col-span-3">
            <UInput
              v-model="form.webhookUrl"
              type="url"
              class="w-full font-mono text-sm"
              placeholder="https://app.example.com/api/v1/emails/inbound"
              :disabled="!config.editable"
            />
          </UFormField>
          <UFormField label="Webhook secret">
            <UInput
              v-model="form.webhookSecret"
              type="password"
              class="w-full"
              autocomplete="new-password"
              :placeholder="config.hasWebhookSecret ? 'Keep current secret' : 'At least 32 characters'"
              :disabled="!config.editable"
            />
          </UFormField>
        </div>

        <div v-if="config.editable" class="flex justify-end">
          <UButton type="submit" icon="i-material-symbols-light-save-outline" :loading="saving"
            >Save inbound settings</UButton
          >
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { InboundEmailConfigView } from "~~/shared/types";

const toast = useToast();
const saving = ref(false);
const testing = ref(false);
const form = reactive({
  enabled: false,
  host: "",
  port: 993,
  secure: true,
  username: "",
  password: "",
  mailbox: "INBOX",
  webhookUrl: "",
  webhookSecret: "",
  pollIntervalSeconds: 30,
});
const { data: config, error, status, refresh } = await useFetch<InboundEmailConfigView>("/api/dashboard/inbound");

watch(
  config,
  (value) => {
    if (!value) return;
    Object.assign(form, {
      enabled: value.enabled,
      host: value.host,
      port: value.port,
      secure: value.secure,
      username: value.username,
      password: "",
      mailbox: value.mailbox,
      webhookUrl: value.webhookUrl,
      webhookSecret: "",
      pollIntervalSeconds: value.pollIntervalSeconds,
    });
  },
  { immediate: true },
);

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Never";
}

async function save() {
  saving.value = true;
  try {
    await $fetch("/api/dashboard/inbound", { method: "PUT", body: form });
    await refresh();
    toast.add({ title: "Inbound settings saved", icon: "i-material-symbols-light-check-circle-outline" });
  } catch (error: any) {
    toast.add({
      title: "Could not save inbound settings",
      description: error.data?.message || "Check the configuration and try again.",
      color: "error",
    });
  } finally {
    saving.value = false;
  }
}

async function testConnection() {
  testing.value = true;
  try {
    const result = await $fetch<{ mailbox: string; messages: number }>("/api/dashboard/inbound/test", {
      method: "POST",
    });
    toast.add({
      title: "IMAP connection succeeded",
      description: `${result.mailbox} contains ${result.messages} messages.`,
      icon: "i-material-symbols-light-check-circle-outline",
    });
  } catch (error: any) {
    toast.add({
      title: "IMAP connection failed",
      description: error.data?.message || "The mailbox could not be reached.",
      color: "error",
    });
  } finally {
    testing.value = false;
  }
}
</script>
