<script lang="ts" setup>
  import type { VueCookies } from 'vue-cookies'
  import { inject } from 'vue'

  import { store } from '../store'
  import CheckBox from './CheckBox.vue'

  const $cookies = inject<VueCookies>('$cookies')

  function toggleFeaturing() {
    location.href = '/toggleFeaturing'
  }
  function logout() {
    $cookies?.set('user', '')
    location.reload()
  }
</script>

<template>
  <div class="container" v-if="store.user">
    <button aria-label="Log out" class="close" title="logout" type="button" @click="logout()">
      <span aria-hidden="true">✕</span>
    </button>
    <div>
      <img alt="" class="avatar" :src="store.user.image" />
      <h1>Hi {{ store.user.name }}!</h1>
      <span>{{ store.user.artists }} followed artists</span>
      <hr class="divider" />
      <div class="content">
        <CheckBox
          description="(any change will refresh the playlist)"
          label="Include featurings"
          :disabled="!store.user.subscribed"
          :onchange="toggleFeaturing"
          :value="store.user.includeFeaturing"
        />
      </div>
    </div>

    <div>
      <hr class="divider" />
      <a class="button" href="/unsubscribe" v-if="store.user.subscribed">unsubscribe to RRR</a>
      <a class="button subscribe" href="/subscribe" v-else>subscribe to RRR</a>
    </div>
  </div>
</template>

<style scoped>
  .close {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2em;
    height: 2em;
    padding: 0;
    font-family: inherit;
    font-size: 0.8em;
    color: #141414;
    cursor: pointer;
    background-color: #fff;
    border: 1px solid rgb(0 0 0 / 30%);
    border-radius: 50%;
  }
  .avatar {
    width: 50px;
    height: 50px;
    margin-bottom: 0.5em;
    /* border: 1px solid #FFF; */
    background-color: rgb(0 0 0 / 10%);
    border-radius: 50%;
  }
  .container {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  }
  .content {
    margin-top: 2em;
  }
  .button {
    color: #ffffffde;
    background-color: #141414;
  }
  .button.subscribe {
    color: #141414;
    background-color: transparent;
    border: 1px solid;
  }
  .divider {
    margin: 2em 0;
  }
  @media (prefers-color-scheme: dark) {
    .button,
    .close {
      color: #141414;
      background-color: #ffffffde;
    }

    .button.subscribe {
      color: #ffffffde;
    }
  }
</style>
