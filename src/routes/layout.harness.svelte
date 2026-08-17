<script lang="ts">
  // Test-only parent: the layout takes the page as a snippet, which cannot be
  // passed from a plain test file.
  import Layout from './+layout.svelte';
</script>

<Layout>
  <p>the page itself</p>
</Layout>
