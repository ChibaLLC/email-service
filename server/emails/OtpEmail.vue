<script lang="ts" setup>
defineProps<{
  code: string;
}>();
</script>

<template>
  <div
    :style="{
      fontFamily: 'sans-serif',
      maxWidth: '400px',
      margin: '0 auto',
      textAlign: 'center',
    }"
  >
    <h2 :style="{ color: '#18181b', fontSize: '20px' }">Your Verification Code</h2>
    <p :style="{ color: '#71717a', fontSize: '14px' }">
      Enter this code to access the dashboard. It expires in 5 minutes.
    </p>
    <div
      :style="{
        background: '#f4f4f5',
        padding: '24px',
        borderRadius: '12px',
        margin: '24px 0',
      }"
    >
      <span
        :style="{
          fontFamily: 'monospace',
          fontSize: '32px',
          fontWeight: 'bold',
          letterSpacing: '8px',
          color: '#18181b',
        }"
      >
        {{ code }}
      </span>
    </div>
    <p :style="{ fontSize: '12px', color: '#a1a1aa' }">If you didn't request this code, ignore this email.</p>
  </div>
</template>
