<script setup lang="ts">
import CheckBox from './CheckBox.vue'
import { store } from '../store'
import { inject } from 'vue';
import {VueCookies} from 'vue-cookies'

const $cookies = inject<VueCookies>('$cookies');

function toggleFeaturing() {
  location.href = "/toggleFeaturing"
}
function logout() {
  $cookies?.set('user', '')
  location.reload()
}
function subscribe() {
  location.href = "/subscribe"
}
function unsubscribe() {
  location.href = "/unsubscribe"
}
</script>

<template>
  <div v-if="store.user" class="container">
    <div @click="logout()" class="close" title="logout">
      <div>✕</div>
    </div>
    <div>
      <img class="avatar" v-bind:src="store.user.image" />
      <h1>Hi {{ store.user.name }}!</h1>
      <span>{{ store.user.artists }} followed artists</span>
      <hr class="divider" />
      <div class="content">
        <CheckBox
          :disabled="!store.user.subscribed"
          :value="store.user.includeFeaturing"
          :onchange="toggleFeaturing"
          label="Include featurings"
          description="(any change will refresh the playlist)"
        />
      </div>
    </div>

    <div>
      <hr class="divider" />
      <a v-if="store.user.subscribed" class="button" @click="unsubscribe()">unsubscribe to RRR</a>
      <a v-else class="button subscribe" @click="subscribe()">subscribe to RRR</a>
    </div>
  </div>
</template>

<style scoped>
.close {
  background-color: #FFF;
  height: 2em;
  width: 2em;
  font-size: 0.8em;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  right: 10px;
  top: 10px;
  border: 1px solid rgb(0 0 0 / 30%);
  cursor: pointer;
  color: #141414;
}
.avatar {
  height: 50px;
  width: 50px;
  border-radius: 50%;
  margin-bottom: 0.5em;
  /* border: 1px solid #FFF; */
  background-color: rgb(0 0 0 / 10%);
}
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.content {
  margin-top: 2em;
}
.button {
  background-color: #141414;
  color: #ffffffde;
}
.button.subscribe {
  background-color: transparent;
  color: #141414;
  border: 1px solid;
}
.divider {
  margin: 2em 0;
}
@media (prefers-color-scheme: dark) {
  .button, .close {
    background-color: #ffffffde;
    color: #141414;
  }

  .button.subscribe {
    color: #ffffffde;
    /* background-color: #141414; */
    color: #ffffffde;
  }
}
</style>
