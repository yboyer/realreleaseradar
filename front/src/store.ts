import { reactive } from 'vue'

type Store = {
  user: null | {
    image: string
    id: string
    name: string
    includeFeaturing: boolean
    subscribed: boolean
  },
  dark: boolean,
} & Record<string, any>

export const store = reactive<Store>({
  user: null,
  dark: false,
  update(value: boolean) {
    this.dark = value
  }
})
