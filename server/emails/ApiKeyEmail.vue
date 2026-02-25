<script lang="ts" setup>
defineProps<{
  apiKey: string;
}>();
</script>

<template>
  <div :style="{ fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }">
    <h2 :style="{ color: '#18181b' }">Your API Key</h2>
    <p :style="{ color: '#71717a' }">
      Here is your API key. <strong>Store it securely — it will not be shown again.</strong>
    </p>
    <div
      :style="{
        background: '#f4f4f5',
        padding: '16px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        wordBreak: 'break-all',
        fontSize: '14px',
      }"
    >
      {{ apiKey }}
    </div>
    <h3 :style="{ color: '#18181b', marginTop: '24px' }">Usage</h3>
    <pre
      :style="{
        background: '#18181b',
        color: '#a1a1aa',
        padding: '16px',
        borderRadius: '8px',
        overflowX: 'auto',
        fontSize: '13px',
      }"
    >
fetch("https://your-domain/send", {
  method: "POST",
  headers: {
    "Authorization": "Bearer {{ apiKey }}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    to: "recipient@example.com",
    subject: "Hello",
    text: "Hello from the email service!"
  })
})</pre
    >
  </div>
</template>
