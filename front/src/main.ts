import { createApp } from 'vue'
import './style.css'
import VueCookies from 'vue-cookies'
import App from './App.vue'

const isDark = window.matchMedia('(prefers-color-scheme: dark)');
const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement

function changeFavicon() {
  favicon.setAttribute('href', isDark.matches ? "/logo-dark.svg" : "/logo-light.svg")
}
isDark.addEventListener('change', changeFavicon)
changeFavicon()

createApp(App)
  .use(VueCookies)
  .mount('#app')
