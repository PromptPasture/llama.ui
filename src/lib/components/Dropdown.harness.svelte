<script lang="ts">
  // Test-only parent: supplies the snippets Dropdown requires and records the
  // option that was chosen.
  import Dropdown from './Dropdown.svelte';

  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    options: Option[];
    filterable?: boolean;
    selectedValue?: string;
    onSelect?: (option: Option) => void;
  }

  let {
    options,
    filterable = false,
    selectedValue = '',
    onSelect = () => {},
  }: Props = $props();
</script>

<Dropdown
  entity="Model"
  {options}
  {filterable}
  isSelected={(o) => o.value === selectedValue}
  {onSelect}
>
  {#snippet currentValue()}
    <span>Current</span>
  {/snippet}
  {#snippet renderOption(option)}
    <span>{option.label}</span>
  {/snippet}
</Dropdown>
