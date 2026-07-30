<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Listmonk</h1>
      <p class="mt-1 text-sm text-gray-400">Configure the authenticated server-side connection and inspect proxy responses.</p>
    </div>

    <section class="rounded-xl bg-white/5 p-5 ring-1 ring-gray-800">
      <div class="mb-5 flex items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-medium">Connection</h2>
            <UBadge :color="settingsForm.enabled ? 'success' : 'neutral'" variant="subtle">{{ settingsForm.enabled ? "Enabled" : "Disabled" }}</UBadge>
          </div>
          <p class="mt-1 text-sm text-gray-500">Credentials stay on the server and are never returned to the browser.</p>
        </div>
        <UButton color="neutral" variant="soft" icon="i-material-symbols-light-cable" :loading="testing" :disabled="!settingsForm.enabled" @click="testConnection">Test</UButton>
      </div>
      <form class="space-y-4" @submit.prevent="saveSettings">
        <div class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950/30 p-4">
          <div><p class="font-medium">Enable Listmonk</p><p class="text-sm text-gray-500">Allow requests through the dashboard proxy.</p></div>
          <USwitch v-model="settingsForm.enabled" />
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <UFormField label="Listmonk URL" class="md:col-span-2"><UInput v-model="settingsForm.url" type="url" class="w-full" placeholder="https://listmonk.example.com" /></UFormField>
          <UFormField label="Username"><UInput v-model="settingsForm.username" class="w-full" autocomplete="username" /></UFormField>
          <UFormField label="Password">
            <UInput v-model="settingsForm.password" type="password" class="w-full" autocomplete="new-password" :placeholder="settings?.hasPassword ? 'Leave blank to keep current password' : 'Enter password'" />
          </UFormField>
        </div>
        <div class="flex justify-end"><UButton type="submit" icon="i-material-symbols-light-save-outline" :loading="saving">Save connection</UButton></div>
      </form>
    </section>

    <section class="rounded-xl bg-white/5 p-5 ring-1 ring-gray-800">
      <div class="mb-4 flex flex-wrap gap-2">
        <UButton v-for="preset in presets" :key="preset.path" :variant="selectedPath === preset.path ? 'solid' : 'ghost'" :color="selectedPath === preset.path ? 'primary' : 'neutral'" @click="selectPreset(preset.path)">{{ preset.label }}</UButton>
      </div>
      <div class="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <UFormField label="Proxy path" help="Appended to /api/dashboard/listmonk."><UInput v-model="selectedPath" class="w-full" placeholder="/lists" /></UFormField>
        <UButton :loading="loading" @click="loadEndpoint">Load</UButton>
      </div>
      <p class="mt-3 rounded-lg bg-gray-950/60 px-4 py-3 font-mono text-xs text-gray-400">GET /api/dashboard/listmonk{{ normalizedPath }}</p>
    </section>

    <UAlert v-if="errorMessage" color="error" variant="subtle" title="Listmonk request failed" :description="errorMessage" />
    <section class="overflow-hidden rounded-xl bg-white/5 ring-1 ring-gray-800">
      <div class="flex items-center justify-between border-b border-gray-800 px-5 py-4">
        <h2 class="font-medium">Proxy response</h2>
        <UBadge color="neutral" variant="subtle">{{ loading ? "Loading" : "Ready" }}</UBadge>
      </div>
      <div class="p-5"><CodeBlock :code="responsePreview" lang="json" /></div>
    </section>
  </div>
</template>

<script setup lang="ts">
type ListmonkSettings = { enabled: boolean; url?: string; baseUrl?: string; username: string; hasPassword: boolean };

definePageMeta({ layout: "dashboard", middleware: ["auth"] });

const toast = useToast();
const saving = ref(false);
const testing = ref(false);
const loading = ref(false);
const errorMessage = ref("");
const selectedPath = ref("/lists");
const responseData = ref<unknown>(null);
const settingsForm = reactive({ enabled: false, url: "", username: "", password: "" });
const presets = [
  { label: "Lists", path: "/lists" },
  { label: "Subscribers", path: "/subscribers" },
  { label: "Campaigns", path: "/campaigns" },
  { label: "Transactional", path: "/tx" },
];

const { data: settings, refresh: refreshSettings } = await useFetch<ListmonkSettings>("/api/dashboard/settings/listmonk");
watch(settings, (value) => {
  if (value) Object.assign(settingsForm, { enabled: value.enabled, url: value.url || value.baseUrl || "", username: value.username, password: "" });
}, { immediate: true });

const normalizedPath = computed(() => {
  const path = selectedPath.value.trim() || "/lists";
  return path.startsWith("/") ? path : `/${path}`;
});
const responsePreview = computed(() => responseData.value === null ? '{\n  "message": "No response loaded yet."\n}' : JSON.stringify(responseData.value, null, 2));

function selectPreset(path: string) { selectedPath.value = path; void loadEndpoint(); }
async function saveSettings() {
  saving.value = true;
  try {
    await $fetch("/api/dashboard/settings/listmonk", {
      method: "PUT",
      body: { enabled: settingsForm.enabled, url: settingsForm.url, baseUrl: settingsForm.url, username: settingsForm.username, password: settingsForm.password || undefined },
    });
    settingsForm.password = "";
    await refreshSettings();
    toast.add({ title: "Listmonk connection saved" });
  } catch (error: any) {
    toast.add({ title: "Could not save Listmonk settings", description: error.data?.message || "Check the connection values.", color: "error" });
  } finally {
    saving.value = false;
  }
}
async function testConnection() {
  testing.value = true;
  try {
    await $fetch("/api/dashboard/settings/listmonk/test", { method: "POST" });
    toast.add({ title: "Listmonk connection succeeded" });
  } catch (error: any) {
    toast.add({ title: "Listmonk connection failed", description: error.data?.message || "Listmonk could not be reached.", color: "error" });
  } finally {
    testing.value = false;
  }
}
async function loadEndpoint() {
  loading.value = true;
  errorMessage.value = "";
  try {
    responseData.value = await $fetch(`/api/dashboard/listmonk${normalizedPath.value}`);
  } catch (error: any) {
    responseData.value = null;
    errorMessage.value = error.data?.message || error.message || "Failed to load the Listmonk endpoint.";
  } finally {
    loading.value = false;
  }
}

await loadEndpoint();
</script>
