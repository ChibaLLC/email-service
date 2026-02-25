<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center">
    <div class="max-w-sm w-full rounded-xl bg-white/5 backdrop-blur ring-1 ring-gray-800 shadow-2xl p-6">
      <div class="text-center mb-6">
        <UIcon name="i-material-symbols-light-dashboard-outline" class="w-10 h-10 text-lime-400 mx-auto" />
        <h1 class="text-xl font-bold text-white mt-2">Dashboard</h1>
        <p class="text-sm text-gray-400 mt-1">
          {{ step === "email" ? "Sign in with your company email" : `Enter the code sent to ${email}` }}
        </p>
      </div>

      <!-- Step 1: Email -->
      <form v-if="step === 'email'" @submit.prevent="sendOTP" class="space-y-4">
        <UFormField label="Email" name="email">
          <UInput v-model="email" type="email" placeholder="you@company.com" class="w-full" />
        </UFormField>
        <UButton type="submit" block :loading="loading" color="primary"> Send Verification Code </UButton>
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
        <UButton variant="ghost" block color="neutral" @click="step = 'email'"> Use a different email </UButton>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false });

const email = ref("");
const code = ref("");
const step = ref<"email" | "code">("email");
const loading = ref(false);
const toast = useToast();

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
</script>
