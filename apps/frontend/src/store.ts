import { reactive } from 'vue'

type Store = {
  user: null | {
    image: string
    id: string
    name: string
    artists: number
    includeFeaturing: boolean
    subscribed: boolean
  }
  dark: boolean
  // oxlint-disable-next-line typescript/no-explicit-any -- Store supports dynamic properties.
} & Record<string, any>

export const store = reactive<Store>({
  user: null,
  dark: false,
  update(value: boolean) {
    this.dark = value
  },
})
