<script lang="ts" setup>
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
      <input id="switch" type="checkbox" :checked="value" :disabled="disabled" :onchange="toggle" />
      <label class="main" for="switch"></label>
    </div>
    <div class="labels">
      <label for="switch">{{ label }}</label>
      <label class="description" for="switch">{{ description }}</label>
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
    display: none;
    visibility: hidden;
    width: 0;
    height: 0;
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
