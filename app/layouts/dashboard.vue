<template>
  <UDashboardGroup class="min-h-screen bg-gray-950 text-white">
    <UDashboardSidebar
      id="dashboard-sidebar"
      v-model:open="sidebarOpen"
      collapsible
      resizable
      :default-size="18"
      :min-size="14"
      :max-size="24"
      class="border-gray-800 bg-gray-950"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/dashboard" class="flex min-w-0 items-center gap-3 font-semibold">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lime-400/10 ring-1 ring-lime-400/20">
            <Icon name="material-symbols-light:mail-outline" class="size-6 text-lime-400" />
          </span>
          <span v-if="!collapsed" class="truncate">Email Service</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :items="navigation"
          orientation="vertical"
          :collapsed="collapsed"
          tooltip
          popover
          class="w-full"
        />
      </template>

      <template #footer="{ collapsed }">
        <div class="flex min-w-0 items-center gap-2" :class="collapsed ? 'justify-center' : ''">
          <div v-if="!collapsed" class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-gray-200">{{ session?.email || "Dashboard user" }}</p>
            <p class="truncate text-xs capitalize text-gray-500">{{ session?.role || "member" }}</p>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-material-symbols-light-logout"
            :loading="loggingOut"
            :aria-label="collapsed ? 'Log out' : undefined"
            @click="logout"
          >
            <span v-if="!collapsed">Log out</span>
          </UButton>
        </div>
      </template>
    </UDashboardSidebar>

    <UDashboardPanel id="dashboard-panel">
      <template #header>
        <UDashboardNavbar :title="pageTitle" class="border-gray-800">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #right>
            <UBadge v-if="session?.role" color="neutral" variant="subtle" class="capitalize">
              {{ session.role }}
            </UBadge>
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <slot />
        </div>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>

<script setup lang="ts">
type DashboardSession = { email: string; role: string | null };

const route = useRoute();
const sidebarOpen = ref(false);
const loggingOut = ref(false);
const { data: session, error: sessionError } = await useFetch<DashboardSession>("/api/dashboard/session");

const baseNavigation = [
  { label: "Overview", icon: "i-material-symbols-light-dashboard-outline", to: "/dashboard", exact: true },
  { label: "Emails", icon: "i-material-symbols-light-mail-outline", to: "/dashboard/emails" },
  { label: "Queue", icon: "i-material-symbols-light-outbox-outline", to: "/dashboard/queue" },
  { label: "Inbound", icon: "i-material-symbols-light-move-to-inbox-outline", to: "/dashboard/inbound" },
  { label: "API Keys", icon: "i-material-symbols-light-key-outline", to: "/dashboard/keys" },
  { label: "Listmonk", icon: "i-material-symbols-light-article-outline", to: "/dashboard/listmonk" },
];
const adminNavigation = [
  { label: "Integrations", icon: "i-material-symbols-light-hub-outline", to: "/dashboard/integrations" },
  { label: "System", icon: "i-material-symbols-light-dns-outline", to: "/dashboard/system" },
];
const navigation = computed(() => {
  const items = [...baseNavigation];
  if (session.value?.role === "owner" || session.value?.role === "admin") items.push(...adminNavigation);
  if (session.value?.role === "owner") items.push({ label: "Access", icon: "i-material-symbols-light-admin-panel-settings-outline", to: "/dashboard/access" });
  return items;
});

watch(sessionError, (error) => {
  if (error?.statusCode === 401) void navigateTo("/dashboard/login");
});

const titles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/emails": "Emails",
  "/dashboard/queue": "Queue",
  "/dashboard/inbound": "Inbound",
  "/dashboard/keys": "API Keys",
  "/dashboard/listmonk": "Listmonk",
  "/dashboard/access": "Access",
  "/dashboard/integrations": "Integrations",
  "/dashboard/system": "System",
};
const pageTitle = computed(() => titles[route.path] || "Dashboard");

async function logout() {
  loggingOut.value = true;
  try {
    await $fetch("/api/dashboard/logout", { method: "POST" });
    await navigateTo("/dashboard/login");
  } finally {
    loggingOut.value = false;
  }
}
</script>
