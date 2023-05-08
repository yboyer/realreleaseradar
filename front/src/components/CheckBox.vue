<script setup lang="ts">
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
			<input type="checkbox" :disabled="disabled" :checked="value" id="switch" :onchange="toggle" />
			<label class="main" for="switch"></label>
		</div>
		<div class="labels">
			<label for="switch">{{ label }}</label>
			<label for="switch" class="description">{{ description }}</label>
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
input[type=checkbox]{
	height: 0;
	width: 0;
	visibility: hidden;
	display: none;
}

.labels {
	text-align: left;
}

label.main {
	cursor: pointer;
	text-indent: -9999px;
	width: 34px;
	height: 21px;
	background: grey;
	display: block;
	border-radius: 20px;
	position: relative;
}

label.main:after {
	content: '';
	position: absolute;
	top: 2px;
	left: 2px;
	width: 17px;
	height: 17px;
	background: #fff;
	border-radius: 17px;
	transition: 0.3s;
}

input:checked + label.main {
	background: #1CD760;
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
	opacity: 0.6;
	line-height: 0.9em;
}
</style>
