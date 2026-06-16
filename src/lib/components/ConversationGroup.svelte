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

  let { group, currentConvId, class: className = '', onitemselect }: Props = $props();
</script>

<div role="group" class={className}>
  <div class="group-title" role="note">
    {$_(`sidebar.groups.${group.title}`, { default: group.title })}
  </div>
  <ul class="group-list" role="menu">
    {#each group.conversations as conv (conv.id)}
      <ConversationItem {conv} {currentConvId} onselect={onitemselect} />
    {/each}
  </ul>
</div>

<style>
  .group-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted);
    padding: 0 0.5rem;
    margin-bottom: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .group-list { list-style: none; margin: 0; padding: 0; }
</style>
