<script setup lang="ts">
import { store } from '../store'
</script>

<template>
  <div class="container">
    <div>
      <img v-if="!store.dark" src="/logo-light.svg" class="logo" />
      <img v-if="store.dark" src="/logo-dark.svg" class="logo" />
      <h1>Real Release Radar</h1>
      <p>All new releases of your followed artists every Friday</p>

    </div>

    <div>
      <a class="button" href="/connect">
        <span class="buttonContainer">
          <img src="/logo-light.svg" class="logo-little" />
          <span>Spotify Connect</span>
        </span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.buttonContainer {
  display: flex;
  align-items: center;
}
.logo {
  height: 3em;
  margin-bottom: 0.5em;
}
.logo-little {
  height: 1em;
  margin-right: .3em;
}
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
}
</style>
