<script lang="ts" setup>
defineProps<{
  apiKey: string;
}>();
</script>

<template>
  <div
    :style="{
      fontFamily: 'Arial, Helvetica, sans-serif',
      maxWidth: '600px',
      margin: '0 auto',
      padding: '32px 24px',
      color: '#27272a',
      lineHeight: 1.6,
    }"
  >
    <p :style="{ margin: '0 0 28px', color: '#71717a', fontSize: '13px' }">Email Service</p>
    <h1 :style="{ margin: '0 0 12px', color: '#18181b', fontSize: '24px', lineHeight: 1.25 }">
      Your API key
    </h1>
    <p :style="{ margin: '0 0 20px', color: '#52525b', fontSize: '15px' }">
      This key will only be shown once. Store it somewhere secure before using it.
    </p>
    <p
      :style="{
        margin: '0 0 28px',
        padding: '14px 0',
        borderTop: '1px solid #d4d4d8',
        borderBottom: '1px solid #d4d4d8',
        fontFamily: 'Courier New, monospace',
        wordBreak: 'break-all',
        fontSize: '14px',
      }"
    >
      {{ apiKey }}
    </p>
    <h2 :style="{ margin: '0 0 8px', color: '#18181b', fontSize: '17px' }">Use the key</h2>
    <p :style="{ margin: '0 0 12px', color: '#52525b', fontSize: '14px' }">
      Send it as a bearer token in the Authorization header.
    </p>
    <pre
      :style="{
        margin: 0,
        background: '#fafafa',
        border: '1px solid #e4e4e7',
        color: '#3f3f46',
        padding: '16px',
        overflowX: 'auto',
        fontFamily: 'Courier New, monospace',
        fontSize: '13px',
        lineHeight: 1.5,
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
