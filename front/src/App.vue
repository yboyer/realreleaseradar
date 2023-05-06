<script setup lang="ts">
import Home from './components/Home.vue'
import Actions from './components/Actions.vue'
import { store } from './store'
import { inject } from 'vue';
import { VueCookies } from 'vue-cookies';

const isDark = window.matchMedia('(prefers-color-scheme: dark)');

const $cookies = inject<VueCookies>('$cookies');

function updateDarkState() {
  store.update(isDark.matches)
}
updateDarkState()
isDark.addEventListener('change', updateDarkState)

if ($cookies?.isKey('user')) {
  try {
    store.user = JSON.parse(atob($cookies.get('user')))
  } catch (e) { }
}
</script>

<template>
  <Home v-if="!store.user" />
  <Actions v-else />
</template>

<style scoped>

</style>
