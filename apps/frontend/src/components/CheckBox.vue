<script lang="ts" setup>
  import { useId } from 'vue'

  const inputId = useId()
  const props = defineProps({
    onchange: Function,
    label: String,
    description: String,
    value: Boolean,
    disabled: Boolean,
  })

  function toggle(a: Event) {
    const value = (<HTMLInputElement>a.target).checked
    props.onchange?.(value)
  }
</script>

<template>
  <div class="root">
    <div class="container">
      <input
        type="checkbox"
        :checked="value"
        :disabled="disabled"
        :id="inputId"
        :onchange="toggle"
      />
      <label class="main" :for="inputId">{{ label }}</label>
    </div>
    <div class="labels">
      <label :for="inputId">{{ label }}</label>
      <label class="description" :for="inputId">{{ description }}</label>
    </div>
  </div>
</template>

<style scoped>
  .root {
    display: flex;
    align-items: center;
  }
  .container {
    display: inline-block;
    margin-right: 0.7em;
  }
  input[type="checkbox"] {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  .labels {
    text-align: left;
  }

  label.main {
    position: relative;
    display: block;
    width: 34px;
    height: 21px;
    text-indent: -9999px;
    cursor: pointer;
    background: grey;
    border-radius: 20px;
  }

  label.main:after {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 17px;
    height: 17px;
    content: "";
    background: #fff;
    border-radius: 17px;
    transition: 0.3s;
  }

  input:focus-visible + label.main {
    outline: 2px solid currentColor;
    outline-offset: 3px;
  }

  input:checked + label.main {
    background: #1cd760;
  }

  input:checked + label.main:after {
    left: calc(100% - 2px);
    transform: translateX(-100%);
  }

  label.main:active:after {
    width: 21px;
  }

  .description {
    display: block;
    font-size: 0.8em;
    line-height: 0.9em;
    opacity: 0.6;
  }
</style>
