<template>
  <div class="space-y-6">
    <section class="overflow-hidden rounded-xl bg-white/5 ring-1 ring-gray-800">
      <div class="flex flex-col gap-4 border-b border-gray-800 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="flex items-center gap-2">
            <UIcon name="i-material-symbols-light-move-to-inbox-outline" class="size-5 text-lime-400" />
            <h2 class="font-semibold">Mail accounts</h2>
            <UBadge color="neutral" variant="subtle">{{ config?.accounts.length || 0 }}</UBadge>
          </div>
          <p class="mt-1 text-sm text-gray-400">Poll multiple IMAP accounts and folders with an independent cursor for every inbox.</p>
        </div>
        <div class="flex gap-2">
          <UButton variant="soft" color="neutral" icon="i-material-symbols-light-refresh" :loading="status === 'pending'" @click="() => refresh()">Refresh</UButton>
          <UButton v-if="config?.canManageAccounts" variant="soft" icon="i-material-symbols-light-add" @click="addAccount">Add account</UButton>
        </div>
      </div>

      <div v-if="error" class="p-5 text-sm text-red-300">{{ error.data?.message || "Could not load inbound settings." }}</div>
      <div v-else-if="config" class="space-y-4 p-5">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-lg bg-gray-950/60 p-3"><div class="text-xs uppercase tracking-wide text-gray-500">Accounts</div><div class="mt-1 text-lg font-semibold">{{ config.accounts.length }}</div></div>
          <div class="rounded-lg bg-gray-950/60 p-3"><div class="text-xs uppercase tracking-wide text-gray-500">Mailboxes</div><div class="mt-1 text-lg font-semibold">{{ mailboxOptions.length }}</div></div>
          <div class="rounded-lg bg-gray-950/60 p-3"><div class="text-xs uppercase tracking-wide text-gray-500">Pending deliveries</div><div class="mt-1 text-lg font-semibold">{{ config.status.pendingDeliveries }}</div></div>
          <div class="rounded-lg bg-gray-950/60 p-3"><div class="text-xs uppercase tracking-wide text-gray-500">Failed deliveries</div><div class="mt-1 text-lg font-semibold" :class="config.status.failedDeliveries ? 'text-red-400' : ''">{{ config.status.failedDeliveries }}</div></div>
        </div>

        <div v-if="accountForms.length === 0" class="rounded-lg border border-dashed border-gray-700 p-8 text-center text-sm text-gray-400">
          No inbound accounts are configured yet.
        </div>
        <article v-for="(account, accountIndex) in accountForms" :key="account.key" class="rounded-lg border border-gray-800 bg-gray-950/30 p-4">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-medium">{{ account.name || `New account ${accountIndex + 1}` }}</h3>
                <UBadge :color="account.enabled ? 'success' : 'neutral'" variant="subtle">{{ account.enabled ? "Polling" : "Paused" }}</UBadge>
              </div>
              <p v-if="account.id" class="mt-1 font-mono text-xs text-gray-500">{{ account.id }}</p>
            </div>
            <div v-if="config.canManageAccounts" class="flex gap-2">
              <UButton v-if="account.id" size="xs" variant="soft" color="primary" icon="i-material-symbols-light-cable" :loading="testingAccount === account.id" @click="testAccount(account.id)">Test</UButton>
              <UButton size="xs" variant="soft" icon="i-material-symbols-light-save-outline" :loading="savingAccount === account.key" @click="saveAccount(account)">Save</UButton>
              <UButton size="xs" variant="ghost" color="error" icon="i-material-symbols-light-delete-outline" @click="removeAccount(account, accountIndex)" />
            </div>
          </div>

          <template v-if="config.canManageAccounts">
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <UFormField label="Account name" class="lg:col-span-2"><UInput v-model="account.name" class="w-full" placeholder="Support mailbox" /></UFormField>
              <UFormField label="IMAP host"><UInput v-model="account.host" class="w-full" placeholder="mail.example.com" /></UFormField>
              <UFormField label="Port"><UInput v-model.number="account.port" type="number" class="w-full" /></UFormField>
              <UFormField label="Username" class="lg:col-span-2"><UInput v-model="account.username" class="w-full" autocomplete="username" /></UFormField>
              <UFormField label="Password" class="lg:col-span-2"><UInput v-model="account.password" type="password" class="w-full" autocomplete="new-password" :placeholder="account.hasPassword ? 'Leave blank to keep current password' : 'Required for a new account'" /></UFormField>
              <UFormField label="Poll interval (seconds)"><UInput v-model.number="account.pollIntervalSeconds" type="number" min="10" max="3600" class="w-full" /></UFormField>
              <label class="flex h-10 items-center gap-3 self-end text-sm text-gray-300"><USwitch v-model="account.secure" />Implicit TLS</label>
              <label class="flex h-10 items-center gap-3 self-end text-sm text-gray-300"><USwitch v-model="account.enabled" />Enable polling</label>
            </div>
            <div class="mt-5 space-y-3">
              <div class="flex items-center justify-between"><div><div class="text-sm font-medium">Folders</div><div class="text-xs text-gray-500">Each folder is tracked independently.</div></div><UButton size="xs" variant="ghost" icon="i-material-symbols-light-add" @click="addMailbox(account)">Add folder</UButton></div>
              <div v-for="(mailbox, mailboxIndex) in account.mailboxes" :key="mailbox.key" class="grid gap-3 rounded-lg bg-gray-950/70 p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                <UFormField label="Display name"><UInput v-model="mailbox.name" class="w-full" placeholder="Primary inbox" /></UFormField>
                <UFormField label="IMAP path"><UInput v-model="mailbox.path" class="w-full font-mono" placeholder="INBOX" /></UFormField>
                <label class="flex h-10 items-center gap-2 text-sm text-gray-300"><USwitch v-model="mailbox.enabled" />Enabled</label>
                <UButton color="error" variant="ghost" icon="i-material-symbols-light-delete-outline" aria-label="Remove folder" :disabled="account.mailboxes.length === 1" @click="() => { account.mailboxes.splice(mailboxIndex, 1); }" />
              </div>
            </div>
          </template>
          <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="mailbox in account.mailboxes" :key="mailbox.id" class="rounded-lg bg-gray-950/60 p-3"><div class="text-sm font-medium">{{ mailbox.name }}</div><div class="mt-1 text-xs text-gray-500">Available for webhook routing</div></div>
          </div>

          <div v-if="account.id && accountStatuses(account.id).length" class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="mailbox in accountStatuses(account.id)" :key="mailbox.mailboxId" class="rounded-lg border border-gray-800 p-3 text-sm">
              <div class="flex items-center justify-between gap-2"><span class="font-medium">{{ mailbox.mailboxName }}</span><span class="font-mono text-xs text-gray-500">UID {{ mailbox.lastUid || "-" }}</span></div>
              <div class="mt-1 text-xs text-gray-500">Last success: {{ formatDate(mailbox.lastSuccessAt) }}</div>
              <div v-if="mailbox.lastError" class="mt-2 text-xs text-red-300">{{ mailbox.lastError }}</div>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section v-if="config" class="overflow-hidden rounded-xl bg-white/5 ring-1 ring-gray-800">
      <div class="flex flex-col gap-4 border-b border-gray-800 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="flex items-center gap-2"><UIcon name="i-material-symbols-light-webhook" class="size-5 text-lime-400" /><h2 class="font-semibold">Webhook destinations</h2><UBadge color="neutral" variant="subtle">{{ webhookForms.length }}</UBadge></div>
          <p class="mt-1 text-sm text-gray-400">Every member can add private destinations. Owners and admins can moderate routing, but only the creator can see credentials or send tests.</p>
        </div>
        <UButton variant="soft" icon="i-material-symbols-light-add" :disabled="mailboxOptions.length === 0" @click="addWebhook">Add webhook</UButton>
      </div>

      <div class="space-y-4 p-5">
        <div v-if="mailboxOptions.length === 0" class="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 text-sm text-amber-200">An administrator must add an account and mailbox before webhooks can be created.</div>
        <div v-if="webhookForms.length === 0" class="rounded-lg border border-dashed border-gray-700 p-8 text-center text-sm text-gray-400">No webhook destinations have been added.</div>
        <article v-for="(webhook, index) in webhookForms" :key="webhook.key" class="rounded-lg border border-gray-800 bg-gray-950/30 p-4">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div><div class="flex items-center gap-2"><h3 class="font-medium">{{ webhook.name || `New webhook ${index + 1}` }}</h3><UBadge :color="webhook.owned ? 'primary' : 'neutral'" variant="subtle">{{ webhook.owned ? "Yours" : webhook.ownerEmail }}</UBadge></div><p class="mt-1 text-xs text-gray-500">{{ webhook.url || (webhook.id ? "Endpoint private to its owner" : "Configure a signed endpoint") }}</p></div>
            <div class="flex gap-2">
              <UButton v-if="webhook.id && webhook.owned" size="xs" variant="soft" color="primary" icon="i-material-symbols-light-send" :loading="testingWebhook === webhook.id" @click="testWebhook(webhook.id)">Send test</UButton>
              <UButton v-if="webhook.canManage" size="xs" variant="soft" icon="i-material-symbols-light-save-outline" :loading="savingWebhook === webhook.key" @click="saveWebhook(webhook)">Save</UButton>
              <UButton v-if="webhook.canManage" size="xs" variant="ghost" color="error" icon="i-material-symbols-light-delete-outline" @click="removeWebhook(webhook, index)" />
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Name"><UInput v-model="webhook.name" class="w-full" :disabled="!webhook.canManage" placeholder="Calendar agent" /></UFormField>
            <UFormField label="Sender filters" hint="Optional"><UInput v-model="webhook.senderFilters" class="w-full" :disabled="!webhook.canManage" placeholder="alerts@example.com, @example.org" /></UFormField>
            <UFormField label="Webhook URL" class="sm:col-span-2"><UInput v-model="webhook.url" type="url" class="w-full font-mono text-sm" :disabled="!webhook.owned && Boolean(webhook.id)" :placeholder="webhook.owned || !webhook.id ? 'https://app.example.com/api/inbound' : 'Private to the webhook owner'" /></UFormField>
            <UFormField label="Webhook secret" class="sm:col-span-2"><UInput v-model="webhook.secret" type="password" class="w-full" autocomplete="new-password" :disabled="!webhook.owned && Boolean(webhook.id)" :placeholder="webhook.hasSecret ? 'Leave blank to keep the current secret' : 'At least 32 characters'" /></UFormField>
          </div>
          <fieldset class="mt-4" :disabled="!webhook.canManage">
            <legend class="mb-2 text-sm font-medium">Deliver email from</legend>
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label v-for="mailbox in mailboxOptions" :key="mailbox.id" class="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-800 bg-gray-950/60 p-3 text-sm has-[:checked]:border-lime-500/50 has-[:checked]:bg-lime-500/5">
                <input v-model="webhook.mailboxIds" type="checkbox" :value="mailbox.id" class="mt-0.5 size-4 accent-lime-400" />
                <span><span class="block font-medium">{{ mailbox.name }}</span><span class="text-xs text-gray-500">{{ mailbox.accountName }}</span></span>
              </label>
            </div>
          </fieldset>
        </article>
      </div>
    </section>

    <section v-if="preview" class="overflow-hidden rounded-xl bg-gray-950 ring-1 ring-lime-500/30">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 p-5">
        <div><div class="flex items-center gap-2"><UIcon name="i-material-symbols-light-data-object" class="size-5 text-lime-400" /><h2 class="font-semibold">Last test delivery</h2><UBadge :color="preview.status && preview.status >= 200 && preview.status < 300 ? 'success' : 'warning'" variant="subtle">{{ preview.status ? `HTTP ${preview.status}` : "Preview generated" }}</UBadge></div><p class="mt-1 text-sm text-gray-400">This is the exact signed request. Replay it in Postman or from your terminal.</p></div>
        <UButton color="neutral" variant="soft" icon="i-material-symbols-light-close" @click="() => { preview = null; }">Close</UButton>
      </div>
      <div class="space-y-5 p-5">
        <div><div class="mb-2 flex items-center justify-between"><h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Request</h3><UButton size="xs" color="neutral" variant="ghost" icon="i-material-symbols-light-content-copy-outline" @click="copy(`${preview.method} ${preview.url}`)">Copy</UButton></div><pre class="overflow-x-auto rounded-lg bg-black/50 p-4 text-sm text-lime-200"><code>{{ preview.method }} {{ preview.url }}</code></pre></div>
        <div><div class="mb-2 flex items-center justify-between"><h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Headers</h3><UButton size="xs" color="neutral" variant="ghost" icon="i-material-symbols-light-content-copy-outline" @click="copy(headerText)">Copy</UButton></div><pre class="overflow-x-auto rounded-lg bg-black/50 p-4 text-xs text-gray-300"><code>{{ headerText }}</code></pre></div>
        <div><div class="mb-2 flex items-center justify-between"><h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">JSON body</h3><UButton size="xs" color="neutral" variant="ghost" icon="i-material-symbols-light-content-copy-outline" @click="copy(prettyBody)">Copy</UButton></div><pre class="overflow-x-auto rounded-lg bg-black/50 p-4 text-xs text-gray-300"><code>{{ prettyBody }}</code></pre></div>
        <div><div class="mb-2 flex items-center justify-between"><h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">cURL</h3><UButton size="xs" color="neutral" variant="ghost" icon="i-material-symbols-light-content-copy-outline" @click="copy(preview.curl)">Copy command</UButton></div><pre class="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-black/50 p-4 text-xs text-sky-200"><code>{{ preview.curl }}</code></pre></div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { InboundEmailConfigView } from "~~/shared/types";

type ViewAccount = InboundEmailConfigView["accounts"][number];
type ViewWebhook = InboundEmailConfigView["webhooks"][number];
type AccountForm = { key: string; id?: string; name: string; enabled: boolean; host: string; port: number; secure: boolean; username: string; password: string; hasPassword: boolean; pollIntervalSeconds: number; mailboxes: MailboxForm[] };
type MailboxForm = { key: string; id?: string; name: string; path: string; enabled: boolean };
type WebhookForm = { key: string; id?: string; name: string; ownerEmail: string; owned: boolean; canManage: boolean; url: string; secret: string; hasSecret: boolean; senderFilters: string; mailboxIds: string[] };
type WebhookPreview = { url: string; method: "POST"; headers: Record<string, string>; body: string; curl: string; status: number | null };

const toast = useToast();
const accountForms = ref<AccountForm[]>([]);
const webhookForms = ref<WebhookForm[]>([]);
const savingAccount = ref<string>();
const savingWebhook = ref<string>();
const testingAccount = ref<string>();
const testingWebhook = ref<string>();
const preview = ref<WebhookPreview | null>(null);
const { data: config, error, status, refresh } = await useFetch<InboundEmailConfigView>("/api/dashboard/inbound");

const mailboxOptions = computed(() => (config.value?.accounts || []).flatMap((account) => account.mailboxes.map((mailbox) => ({ id: mailbox.id, name: mailbox.name, accountName: account.name }))));
const headerText = computed(() => preview.value ? Object.entries(preview.value.headers).map(([name, value]) => `${name}: ${value}`).join("\n") : "");
const prettyBody = computed(() => {
  if (!preview.value) return "";
  try { return JSON.stringify(JSON.parse(preview.value.body), null, 2); } catch { return preview.value.body; }
});

function accountToForm(account: ViewAccount): AccountForm {
  return { key: account.id, id: account.id, name: account.name, enabled: account.enabled ?? false, host: account.host || "", port: account.port || 993, secure: account.secure ?? true, username: account.username || "", password: "", hasPassword: account.hasPassword ?? false, pollIntervalSeconds: account.pollIntervalSeconds || 30, mailboxes: account.mailboxes.map((mailbox) => ({ key: mailbox.id, id: mailbox.id, name: mailbox.name, path: mailbox.path || "", enabled: mailbox.enabled ?? true })) };
}
function webhookToForm(webhook: ViewWebhook): WebhookForm {
  return { key: webhook.id, id: webhook.id, name: webhook.name, ownerEmail: webhook.ownerEmail, owned: webhook.owned, canManage: webhook.canManage, url: webhook.url || "", secret: "", hasSecret: webhook.hasSecret, senderFilters: webhook.senderFilters.join(", "), mailboxIds: [...webhook.mailboxIds] };
}
watch(config, (value) => {
  if (!value) return;
  accountForms.value = value.accounts.map(accountToForm);
  webhookForms.value = value.webhooks.map(webhookToForm);
}, { immediate: true });

function addMailbox(account: AccountForm) { account.mailboxes.push({ key: crypto.randomUUID(), name: "", path: "INBOX", enabled: true }); }
function addAccount() { accountForms.value.push({ key: crypto.randomUUID(), name: "", enabled: true, host: "", port: 993, secure: true, username: "", password: "", hasPassword: false, pollIntervalSeconds: 30, mailboxes: [{ key: crypto.randomUUID(), name: "Inbox", path: "INBOX", enabled: true }] }); }
function addWebhook() { webhookForms.value.push({ key: crypto.randomUUID(), name: "", ownerEmail: "You", owned: true, canManage: true, url: "", secret: "", hasSecret: false, senderFilters: "", mailboxIds: [] }); }
function accountStatuses(accountId: string) { return config.value?.status.mailboxes.filter((mailbox) => mailbox.accountId === accountId) || []; }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleString() : "Never"; }
function message(error: any, fallback: string) { return error.data?.message || error.message || fallback; }

async function saveAccount(account: AccountForm) {
  savingAccount.value = account.key;
  try {
    const body = { name: account.name, enabled: account.enabled, host: account.host, port: account.port, secure: account.secure, username: account.username, password: account.password || undefined, pollIntervalSeconds: account.pollIntervalSeconds, mailboxes: account.mailboxes.map(({ id, name, path, enabled }) => ({ id, name, path, enabled })) };
    await $fetch(account.id ? `/api/dashboard/inbound/accounts/${account.id}` : "/api/dashboard/inbound/accounts", { method: account.id ? "PUT" : "POST", body });
    await refresh();
    toast.add({ title: "Account saved", icon: "i-material-symbols-light-check-circle-outline" });
  } catch (error: any) { toast.add({ title: "Could not save account", description: message(error, "Check the account settings."), color: "error" }); }
  finally { savingAccount.value = undefined; }
}
async function removeAccount(account: AccountForm, index: number) {
  if (!account.id) { accountForms.value.splice(index, 1); return; }
  if (!confirm(`Delete ${account.name} and its mailbox routes?`)) return;
  try { await $fetch(`/api/dashboard/inbound/accounts/${account.id}`, { method: "DELETE" }); await refresh(); toast.add({ title: "Account deleted" }); }
  catch (error: any) { toast.add({ title: "Could not delete account", description: message(error, "Try again."), color: "error" }); }
}
async function testAccount(id: string) {
  testingAccount.value = id;
  try { const result = await $fetch<{ mailboxes: { name: string; path: string; messages: number }[] }>(`/api/dashboard/inbound/accounts/${id}/test`, { method: "POST" }); toast.add({ title: "IMAP connection succeeded", description: `${result.mailboxes.length} mailbox${result.mailboxes.length === 1 ? "" : "es"} opened successfully.`, icon: "i-material-symbols-light-check-circle-outline" }); }
  catch (error: any) { toast.add({ title: "IMAP connection failed", description: message(error, "The account could not be reached."), color: "error" }); }
  finally { testingAccount.value = undefined; }
}
function webhookBody(webhook: WebhookForm) { return { name: webhook.name, url: webhook.url || undefined, secret: webhook.secret || undefined, senderFilters: webhook.senderFilters.split(",").map((filter) => filter.trim()).filter(Boolean), mailboxIds: webhook.mailboxIds }; }
async function saveWebhook(webhook: WebhookForm) {
  savingWebhook.value = webhook.key;
  try {
    await $fetch(webhook.id ? `/api/dashboard/inbound/webhooks/${webhook.id}` : "/api/dashboard/inbound/webhooks", { method: webhook.id ? "PUT" : "POST", body: webhookBody(webhook) });
    await refresh();
    toast.add({ title: "Webhook saved", icon: "i-material-symbols-light-check-circle-outline" });
  } catch (error: any) { toast.add({ title: "Could not save webhook", description: message(error, "Check the destination and routing."), color: "error" }); }
  finally { savingWebhook.value = undefined; }
}
async function removeWebhook(webhook: WebhookForm, index: number) {
  if (!webhook.id) { webhookForms.value.splice(index, 1); return; }
  if (!confirm(`Delete ${webhook.name}? Pending deliveries keep their original destination.`)) return;
  try { await $fetch(`/api/dashboard/inbound/webhooks/${webhook.id}`, { method: "DELETE" }); await refresh(); toast.add({ title: "Webhook deleted" }); }
  catch (error: any) { toast.add({ title: "Could not delete webhook", description: message(error, "Try again."), color: "error" }); }
}
async function testWebhook(id: string) {
  testingWebhook.value = id;
  try {
    preview.value = await $fetch<WebhookPreview>(`/api/dashboard/inbound/webhooks/${id}/test`, { method: "POST" });
    toast.add({ title: preview.value.status ? "Webhook test sent" : "Request preview generated", description: preview.value.status ? `Destination returned HTTP ${preview.value.status}.` : "The destination was unreachable; the exact request is available below.", icon: "i-material-symbols-light-check-circle-outline" });
    await nextTick();
    document.querySelector("section:last-of-type")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error: any) { toast.add({ title: "Could not generate webhook test", description: message(error, "Try again."), color: "error" }); }
  finally { testingWebhook.value = undefined; }
}
async function copy(value: string) { await navigator.clipboard.writeText(value); toast.add({ title: "Copied to clipboard" }); }
</script>
