<script>
export default {
  props: ['id', 'msg'],
}
</script>

<template>
  <span :id="id">Message: {{ msg }}</span>
</template>
