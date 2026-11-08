<script lang="ts" setup>
  import { store } from '../store'
</script>

<template>
  <div class="container">
    <div>
      <img class="logo" src="/logo-light.svg" v-if="!store.dark" />
      <img class="logo" src="/logo-dark.svg" v-if="store.dark" />
      <h1>Real Release Radar</h1>
      <p>All new releases of your followed artists every Friday</p>
    </div>

    <div>
      <a class="button" href="/connect">
        <span class="buttonContainer">
          <img class="logo-little" src="/logo-light.svg" />
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
    margin-right: 0.3em;
  }
  .container {
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    height: 100%;
  }
</style>
