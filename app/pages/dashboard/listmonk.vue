<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <header class="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 gap-4">
        <div class="flex items-center gap-3">
          <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-material-symbols-light-arrow-back">
            Back
          </UButton>
          <div>
            <h1 class="text-lg font-bold">Listmonk</h1>
            <p class="text-sm text-gray-400">Dashboard access through the authenticated Listmonk proxy.</p>
          </div>
        </div>

        <UButton
          variant="subtle"
          color="primary"
          icon="i-material-symbols-light-refresh"
          :loading="loading"
          @click="loadEndpoint"
        >
          Refresh
        </UButton>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div class="rounded-xl bg-white/5 ring-1 ring-gray-800 p-5 space-y-5">
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="preset in presets"
            :key="preset.path"
            :variant="selectedPath === preset.path ? 'solid' : 'ghost'"
            :color="selectedPath === preset.path ? 'primary' : 'neutral'"
            @click="selectPreset(preset.path)"
          >
            {{ preset.label }}
          </UButton>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end">
          <UFormField label="Proxy path" help="This is appended to /api/dashboard/listmonk.">
            <UInput v-model="selectedPath" placeholder="/lists" class="w-full" />
          </UFormField>
          <UButton color="primary" :loading="loading" @click="loadEndpoint">
            Load
          </UButton>
        </div>

        <div class="rounded-lg bg-gray-900/70 ring-1 ring-gray-800 px-4 py-3 text-sm text-gray-300">
          <span class="text-gray-500">Request:</span>
          <span class="font-mono">GET /api/dashboard/listmonk{{ normalizedPath }}</span>
        </div>
      </div>

      <div v-if="errorMessage" class="rounded-xl bg-red-500/10 ring-1 ring-red-500/30 p-4 text-sm text-red-200">
        {{ errorMessage }}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div class="rounded-xl bg-white/5 ring-1 ring-gray-800 p-5 space-y-3">
          <h2 class="text-sm font-medium text-gray-400">Quick Notes</h2>
          <p class="text-sm text-gray-300">Requests on this page stay inside the dashboard session and go through the server-side proxy.</p>
          <p class="text-sm text-gray-300">Use it to inspect Listmonk resources without exposing API credentials in the browser.</p>
          <p class="text-xs text-gray-500">The proxy forwards to <span class="font-mono">LISTMONK_API_URL/api/**</span>.</p>
        </div>

        <div class="lg:col-span-3 rounded-xl bg-white/5 ring-1 ring-gray-800 p-5 space-y-4 overflow-hidden">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-sm font-medium text-gray-400">Response</h2>
            <UBadge variant="subtle" color="neutral">{{ loading ? 'Loading' : 'Ready' }}</UBadge>
          </div>

          <CodeBlock :code="responsePreview" lang="json" />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false, middleware: ["auth"] });

const toast = useToast();

const presets = [
  { label: "Lists", path: "/lists" },
  { label: "Subscribers", path: "/subscribers" },
  { label: "Campaigns", path: "/campaigns" },
  { label: "Transactional", path: "/tx" },
];

const selectedPath = ref("/lists");
const loading = ref(false);
const errorMessage = ref("");
const responseData = ref<unknown>(null);

const normalizedPath = computed(() => {
  const trimmed = selectedPath.value.trim();
  if (!trimmed) return "/lists";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
});

const responsePreview = computed(() => {
  if (responseData.value === null) {
    return '{\n  "message": "No response loaded yet."\n}';
  }

  return JSON.stringify(responseData.value, null, 2);
});

function selectPreset(path: string) {
  selectedPath.value = path;
  void loadEndpoint();
}

async function loadEndpoint() {
  loading.value = true;
  errorMessage.value = "";

  try {
    responseData.value = await $fetch(`/api/dashboard/listmonk${normalizedPath.value}`);
  } catch (error: any) {
    responseData.value = null;
    errorMessage.value = error?.data?.message || error?.message || "Failed to load the Listmonk endpoint.";
    toast.add({
      title: "Listmonk request failed",
      description: errorMessage.value,
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}

await loadEndpoint();
</script>