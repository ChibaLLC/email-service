<script lang="ts" setup>
defineProps<{
  code: string;
}>();
</script>

<template>
  <div
    :style="{
      fontFamily: 'Arial, Helvetica, sans-serif',
      maxWidth: '480px',
      margin: '0 auto',
      padding: '32px 24px',
      color: '#27272a',
      lineHeight: 1.6,
    }"
  >
    <p :style="{ margin: '0 0 28px', color: '#71717a', fontSize: '13px' }">Email Service</p>
    <h1 :style="{ margin: '0 0 12px', color: '#18181b', fontSize: '24px', lineHeight: 1.25 }">
      Sign in to your dashboard
    </h1>
    <p :style="{ margin: '0 0 24px', color: '#52525b', fontSize: '15px' }">
      Use this code to finish signing in:
    </p>
    <p
      :style="{
        margin: '0 0 20px',
        padding: '16px 0',
        borderTop: '1px solid #d4d4d8',
        borderBottom: '1px solid #d4d4d8',
        fontFamily: 'Courier New, monospace',
        fontSize: '28px',
        fontWeight: 'bold',
        letterSpacing: '2px',
        color: '#18181b',
      }"
    >
      {{ code }}
    </p>
    <p :style="{ margin: '0 0 28px', color: '#52525b', fontSize: '14px' }">
      The code expires in 5 minutes.
    </p>
    <p :style="{ margin: 0, fontSize: '13px', color: '#71717a' }">
      If you did not try to sign in, you can ignore this email.
    </p>
  </div>
</template>
