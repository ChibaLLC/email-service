<script lang="ts" setup>
defineProps<{
  email: string;
  provider: string;
  sentAt: string;
}>();
</script>

<template>
  <div :style="{ fontFamily: 'sans-serif', maxWidth: '560px', margin: '0 auto', color: '#18181b' }">
    <h2 :style="{ fontSize: '22px', marginBottom: '12px' }">Email Provider Test</h2>
    <p :style="{ color: '#52525b', lineHeight: 1.6 }">
      This is a dashboard-triggered test email for <strong>{{ email }}</strong>.
    </p>
    <div
      :style="{
        background: '#f4f4f5',
        borderRadius: '12px',
        padding: '18px',
        margin: '20px 0',
      }"
    >
      <p :style="{ margin: '0 0 8px', fontSize: '14px', color: '#71717a' }">Selected provider</p>
      <p :style="{ margin: 0, fontSize: '18px', fontWeight: 'bold' }">{{ provider }}</p>
    </div>
    <p :style="{ color: '#52525b', lineHeight: 1.6 }">
      Sent at <strong>{{ sentAt }}</strong>. If you received this message, the configured provider can accept mail from this environment.
    </p>
  </div>
</template>