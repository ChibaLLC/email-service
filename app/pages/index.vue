<template>
  <UContainer>
    <Title>Email Service — API</Title>
    <div class="absolute w-full h-full radial-gradient top-0 left-0"></div>
    <Transition mode="out-in">
      <!-- Post-success: API Documentation -->
      <div v-if="success" class="min-h-screen py-12">
        <div class="max-w-3xl mx-auto space-y-6">
          <!-- Header -->
          <div class="text-center mb-8">
            <UIcon name="i-material-symbols-light-check-circle-outline" class="w-12 h-12 text-lime-400 mx-auto" />
            <h1 class="text-2xl font-bold text-white mt-3">API Key Sent!</h1>
            <p class="text-gray-400 mt-1">Check your email. Below is your API reference.</p>
          </div>

          <!-- Endpoint Reference -->
          <article class="rounded-xl bg-white/5 backdrop-blur ring-1 ring-gray-800 p-6 space-y-5">
            <h2 class="text-lg font-bold text-white">Send Email</h2>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded text-xs font-bold bg-lime-400/20 text-lime-400">POST</span>
              <code class="text-sm text-gray-300">/send</code>
            </div>

            <div>
              <h3 class="text-sm font-semibold text-gray-400 mb-2">Headers</h3>
              <div class="bg-gray-900 rounded-lg p-3 text-sm font-mono text-gray-300 space-y-1">
                <div><span class="text-lime-400">Authorization</span>: Bearer YOUR_API_KEY</div>
                <div><span class="text-lime-400">Content-Type</span>: application/json</div>
              </div>
            </div>

            <div>
              <h3 class="text-sm font-semibold text-gray-400 mb-2">Request Body</h3>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-gray-500 border-b border-gray-800">
                      <th class="py-2 pr-4">Field</th>
                      <th class="py-2 pr-4">Type</th>
                      <th class="py-2 pr-4">Required</th>
                      <th class="py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody class="text-gray-300">
                    <tr class="border-b border-gray-800/50">
                      <td class="py-2 pr-4 font-mono text-lime-400">to</td>
                      <td class="py-2 pr-4">string | string[]</td>
                      <td class="py-2 pr-4">✓</td>
                      <td class="py-2">Recipient(s)</td>
                    </tr>
                    <tr class="border-b border-gray-800/50">
                      <td class="py-2 pr-4 font-mono text-lime-400">subject</td>
                      <td class="py-2 pr-4">string</td>
                      <td class="py-2 pr-4">✓</td>
                      <td class="py-2">Email subject</td>
                    </tr>
                    <tr class="border-b border-gray-800/50">
                      <td class="py-2 pr-4 font-mono text-lime-400">text</td>
                      <td class="py-2 pr-4">string</td>
                      <td class="py-2 pr-4">*</td>
                      <td class="py-2">Plain text body</td>
                    </tr>
                    <tr class="border-b border-gray-800/50">
                      <td class="py-2 pr-4 font-mono text-lime-400">html</td>
                      <td class="py-2 pr-4">string</td>
                      <td class="py-2 pr-4">*</td>
                      <td class="py-2">HTML body</td>
                    </tr>
                    <tr>
                      <td class="py-2 pr-4 font-mono text-lime-400">from</td>
                      <td class="py-2 pr-4">string</td>
                      <td class="py-2 pr-4"></td>
                      <td class="py-2">Sender (defaults to service default)</td>
                    </tr>
                  </tbody>
                </table>
                <p class="text-xs text-gray-500 mt-1">
                  * Either <code class="text-gray-400">text</code> or <code class="text-gray-400">html</code> is
                  required.
                </p>
              </div>
            </div>

            <!-- cURL Example -->
            <div>
              <h3 class="text-sm font-semibold text-gray-400 mb-2">cURL</h3>
              <pre class="text-sm bg-gray-900 text-gray-300 p-4 rounded-lg overflow-x-auto">
curl -X POST https://your-domain/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Hello",
    "text": "Hello from the email service!"
  }'</pre
              >
            </div>

            <!-- Fetch Example -->
            <div>
              <h3 class="text-sm font-semibold text-gray-400 mb-2">JavaScript (fetch)</h3>
              <pre class="text-sm bg-gray-900 text-gray-300 p-4 rounded-lg overflow-x-auto">
const response = await fetch("https://your-domain/send", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    to: "recipient@example.com",
    subject: "Hello",
    html: "&lt;h1&gt;Hello!&lt;/h1&gt;&lt;p&gt;Sent via the email service.&lt;/p&gt;"
  })
})</pre
              >
            </div>

            <!-- Response Codes -->
            <div>
              <h3 class="text-sm font-semibold text-gray-400 mb-2">Response Codes</h3>
              <div class="grid grid-cols-2 gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-400/20 text-emerald-400">200</span>
                  <span class="text-gray-300">Email queued</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-400/20 text-amber-400">400</span>
                  <span class="text-gray-300">Invalid request</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded text-xs font-bold bg-red-400/20 text-red-400">401</span>
                  <span class="text-gray-300">Invalid API key</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded text-xs font-bold bg-red-400/20 text-red-400">500</span>
                  <span class="text-gray-300">Server error</span>
                </div>
              </div>
            </div>
          </article>

          <div class="text-center">
            <UButton variant="ghost" color="neutral" @click="reset"> Request another API key </UButton>
          </div>
        </div>
      </div>

      <!-- Pre-success: API Key Request Form -->
      <div class="h-screen grid place-items-center" v-else>
        <div
          class="rounded-xl divide-y divide-gray-200 dark:divide-gray-800 ring-1 ring-gray-200 dark:ring-gray-800 shadow max-w-sm w-full bg-white/75 dark:bg-white/5 backdrop-blur h-fit mx-auto -mt-60"
        >
          <div class="px-4 py-5 sm:p-6">
            <div class="text-center">
              <div class="pointer-events-none">
                <UIcon
                  name="i-material-symbols-light-mail-outline"
                  class="w-8 h-8 shrink-0 text-gray-900 dark:text-white"
                />
              </div>
              <div class="text-xl text-gray-900 dark:text-white font-bold capitalize">email service</div>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Get an API key to start sending emails programmatically.
              </p>
            </div>
            <UForm :schema="emailShema" :state="state" class="space-y-4 mt-4" @submit="onSubmit">
              <UFormField label="Email" name="email" help="Enter your company email. The API key will be sent there.">
                <UInput v-model="state.email" class="w-full" placeholder="you@company.com" />
              </UFormField>
              <UButton type="submit" block :loading="loading" loading-icon="i-line-md-loading-loop">
                Get API Key
              </UButton>
            </UForm>
          </div>
        </div>
      </div>
    </Transition>
  </UContainer>
</template>

<script setup lang="ts">
import { z } from "zod";
import type { FormSubmitEvent } from "#ui/types";

const state = reactive({
  email: undefined,
});

type Schema = z.output<typeof emailShema>;
const loading = ref(false);
const success = ref(false);
const toast = useToast();

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true;
  const response = await $fetch("/api/key", {
    method: "POST",
    body: { email: event.data.email },
  }).catch((e) => {
    toast.add({
      icon: "i-material-symbols-error-outline-rounded",
      title: "An error occurred",
      description: String(e.data?.message || e.message || e),
      color: "error",
    });
  });

  if (response) {
    toast.add({
      title: "API key sent to your email!",
    });
    success.value = true;
    sessionStorage.setItem("__MAIL_KEY__success", "true");
  }

  loading.value = false;
}

function reset() {
  success.value = false;
  sessionStorage.removeItem("__MAIL_KEY__success");
}

onMounted(() => {
  const value = sessionStorage.getItem("__MAIL_KEY__success");
  success.value = value === "true";
});
</script>

<style>
.radial-gradient {
  background: radial-gradient(50% 50% at 50% 50%, rgb(56 189 248 / 0.1) 0, rgb(3 7 18));
}

.v-enter-active,
.v-leave-active {
  transition: opacity 0.5s ease;
}
.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
