<script lang="ts" setup>
defineProps<{
  email: string;
  provider: string;
  sentAt: string;
}>();
</script>

<template>
  <div
    :style="{
      fontFamily: 'Arial, Helvetica, sans-serif',
      maxWidth: '560px',
      margin: '0 auto',
      padding: '32px 24px',
      color: '#27272a',
      lineHeight: 1.6,
    }"
  >
    <p :style="{ margin: '0 0 28px', color: '#71717a', fontSize: '13px' }">Email Service</p>
    <h1 :style="{ margin: '0 0 12px', color: '#18181b', fontSize: '24px', lineHeight: 1.25 }">
      Your test email arrived
    </h1>
    <p :style="{ margin: '0 0 16px', color: '#52525b', fontSize: '15px' }">
      Email delivery through <strong>{{ provider }}</strong> is working.
    </p>
    <p :style="{ margin: 0, color: '#71717a', fontSize: '13px' }">
      Sent to {{ email }} at {{ sentAt }}.
    </p>
  </div>
</template>
