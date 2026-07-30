<template>
  <form class="space-y-6" @submit.prevent="save">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Access settings</h1>
        <p class="mt-1 text-sm text-gray-400">Control allowed domains and dashboard membership.</p>
      </div>
      <UButton type="submit" icon="i-material-symbols-light-save-outline" :loading="saving">Save changes</UButton>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" title="Access settings unavailable" description="Only configured administrators can manage access." />
    <template v-else>
      <section class="grid gap-5 rounded-xl bg-white/5 p-5 ring-1 ring-gray-800 lg:grid-cols-2">
        <UFormField label="Dashboard login domains" help="Comma-separated domains allowed to request a login code.">
          <UTextarea v-model="loginDomains" :rows="4" class="w-full" placeholder="example.com, company.org" />
        </UFormField>
        <UFormField label="API key domains" help="Comma-separated domains allowed to request API keys.">
          <UTextarea v-model="apiKeyDomains" :rows="4" class="w-full" placeholder="example.com, company.org" />
        </UFormField>
      </section>

      <section class="overflow-hidden rounded-xl bg-white/5 ring-1 ring-gray-800">
        <div class="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <div>
            <h2 class="font-medium">Members</h2>
            <p class="mt-1 text-sm text-gray-500">Explicit dashboard users and their roles.</p>
          </div>
          <UButton type="button" color="neutral" variant="soft" icon="i-material-symbols-light-person-add-outline" @click="addMember">Add member</UButton>
        </div>
        <div v-if="members.length" class="divide-y divide-gray-800">
          <div v-for="(member, index) in members" :key="index" class="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end sm:px-5">
            <UFormField label="Email"><UInput v-model="member.email" type="email" class="w-full" placeholder="user@example.com" /></UFormField>
            <UFormField label="Role">
              <USelect v-model="member.role" :items="roles" class="w-full" />
            </UFormField>
            <UButton type="button" color="error" variant="ghost" icon="i-material-symbols-light-delete-outline" aria-label="Remove member" @click="() => { members.splice(index, 1); }" />
          </div>
        </div>
        <div v-else class="p-8 text-center text-sm text-gray-500">No explicit members configured.</div>
      </section>
    </template>
  </form>
</template>

<script setup lang="ts">
type AccessMember = { email: string; role: string };
type AccessSettings = { loginDomains: string[]; apiKeyDomains: string[]; members: AccessMember[] };

definePageMeta({ layout: "dashboard", middleware: ["auth"] });

const toast = useToast();
const saving = ref(false);
const loginDomains = ref("");
const apiKeyDomains = ref("");
const members = ref<AccessMember[]>([]);
const roles = ["owner", "admin", "operator", "viewer"];
const { data: settings, error, refresh } = await useFetch<AccessSettings>("/api/dashboard/settings/access");

watch(settings, (value) => {
  if (!value) return;
  loginDomains.value = value.loginDomains.join(", ");
  apiKeyDomains.value = value.apiKeyDomains.join(", ");
  members.value = value.members.map((member) => ({ ...member }));
}, { immediate: true });

function parseDomains(value: string) { return value.split(/[\s,]+/).map((domain) => domain.trim()).filter(Boolean); }
function addMember() { members.value.push({ email: "", role: "viewer" }); }
async function save() {
  saving.value = true;
  try {
    await $fetch("/api/dashboard/settings/access", {
      method: "PUT",
      body: { loginDomains: parseDomains(loginDomains.value), apiKeyDomains: parseDomains(apiKeyDomains.value), members: members.value },
    });
    await refresh();
    toast.add({ title: "Access settings saved" });
  } catch (saveError: any) {
    toast.add({ title: "Could not save access settings", description: saveError.data?.message || "Check the values and try again.", color: "error" });
  } finally {
    saving.value = false;
  }
}
</script>
