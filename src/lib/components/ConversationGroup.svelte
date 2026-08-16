<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { GroupedConversations } from '$lib/utils/conversation-grouper';
  import ConversationItem from './ConversationItem.svelte';

  interface Props {
    group: GroupedConversations;
    currentConvId?: string;
    class?: string;
    onitemselect?: () => void;
  }

  let {
    group,
    currentConvId,
    class: className = '',
    onitemselect,
  }: Props = $props();
</script>

<div role="group" class={className}>
  <div class="conv-group__label" role="note">
    {$_(`sidebar.groups.${group.title}`, { default: group.title })}
  </div>
  <ul class="conv-group__list" role="menu">
    {#each group.conversations as conv (conv.id)}
      <ConversationItem {conv} {currentConvId} onselect={onitemselect} />
    {/each}
  </ul>
</div>

<style>
  @reference "tailwindcss";
  .conv-group__label {
    @apply text-xs font-semibold uppercase px-2 mb-1;
    color: var(--color-text-muted);
    letter-spacing: 0.05em;
  }

  .conv-group__list {
    @apply list-none m-0 p-0;
  }
</style>
