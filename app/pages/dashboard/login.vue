<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center">
    <div class="max-w-sm w-full rounded-xl bg-white/5 backdrop-blur ring-1 ring-gray-800 shadow-2xl p-6">
      <div class="text-center mb-6">
        <Icon name="material-symbols-light:dashboard-outline" class="mx-auto size-10 text-lime-400" />
        <h1 class="text-xl font-bold text-white mt-2">Dashboard</h1>
        <p class="text-sm text-gray-400 mt-1">
          {{ setupMode ? "Configure a new installation" : step === "email" ? "Sign in with your company email" : `Enter the code sent to ${email}` }}
        </p>
      </div>

      <!-- Step 1: Email -->
      <form v-if="setupMode" @submit.prevent="bootstrapDashboard" class="space-y-4">
        <UFormField label="Owner email" name="email">
          <UInput v-model="email" type="email" placeholder="owner@example.com" class="w-full" />
        </UFormField>
        <UFormField label="Setup code" name="setupCode" help="Find the one-time code in the application startup logs.">
          <UInput v-model="setupCode" type="password" autocomplete="off" placeholder="One-time setup code" class="w-full" />
        </UFormField>
        <UButton type="submit" block :loading="loading" color="primary"> Open Setup Dashboard </UButton>
        <UButton variant="ghost" block color="neutral" @click="closeSetup"> Back to email login </UButton>
      </form>

      <form v-else-if="step === 'email'" @submit.prevent="sendOTP" class="space-y-4">
        <UFormField label="Email" name="email">
          <UInput v-model="email" type="email" placeholder="you@company.com" class="w-full" />
        </UFormField>
        <UButton type="submit" block :loading="loading" color="primary"> Send Verification Code </UButton>
        <UButton variant="ghost" block color="neutral" @click="openSetup"> First-time setup </UButton>
      </form>

      <!-- Step 2: OTP Code -->
      <form v-else @submit.prevent="verifyCode" class="space-y-4">
        <UFormField label="Verification Code" name="code" help="Check your inbox for a 6-digit code">
          <UInput
            v-model="code"
            placeholder="000000"
            maxlength="6"
            class="w-full text-center text-2xl tracking-[0.5em] font-mono"
          />
        </UFormField>
        <UButton type="submit" block :loading="loading" color="primary"> Verify & Sign In </UButton>
        <UButton variant="ghost" block color="neutral" @click="useDifferentEmail"> Use a different email </UButton>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false, middleware: ["guest"] });

const email = ref("");
const code = ref("");
const setupCode = ref("");
const setupMode = ref(false);
const step = ref<"email" | "code">("email");
const loading = ref(false);
const toast = useToast();

function useDifferentEmail() {
  step.value = "email";
}

function openSetup() {
  setupMode.value = true;
}

function closeSetup() {
  setupMode.value = false;
}

async function sendOTP() {
  if (!email.value) return;
  loading.value = true;
  try {
    await $fetch("/api/dashboard/login", {
      method: "POST",
      body: { email: email.value },
    });
    step.value = "code";
    toast.add({
      title: "Code sent!",
      description: "Check your email for the verification code.",
      icon: "i-material-symbols-light-mail-outline",
    });
  } catch (e: any) {
    toast.add({
      title: "Failed to send code",
      description: e.data?.message || "Could not send verification code",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}

async function verifyCode() {
  if (!code.value || code.value.length !== 6) return;
  loading.value = true;
  try {
    await $fetch("/api/dashboard/verify", {
      method: "POST",
      body: { email: email.value, code: code.value },
    });
    navigateTo("/dashboard");
  } catch (e: any) {
    toast.add({
      title: "Verification failed",
      description: e.data?.message || "Invalid or expired code",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}

async function bootstrapDashboard() {
  if (!email.value || !setupCode.value) return;
  loading.value = true;
  try {
    await $fetch("/api/dashboard/bootstrap", {
      method: "POST",
      body: { email: email.value, code: setupCode.value },
    });
    setupCode.value = "";
    await navigateTo("/dashboard/outbound");
  } catch (e: any) {
    toast.add({
      title: "Setup failed",
      description: e.data?.message || "Invalid owner email or setup code",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}
</script>
