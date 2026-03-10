import { memo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { GroupedConversations } from '../utils/conversation-grouper';
import { ConversationItem } from './ConversationItem';
import { Label } from './Label';

export const ConversationGroup = memo(
  ({
    className,
    group,
    onItemSelect,
  }: {
    className?: string;
    group: GroupedConversations;
    onItemSelect: () => void;
  }) => {
    const { t } = useTranslation();

    return (
      <div role="group" className={className}>
        <Label
          className="px-2 opacity-75"
          variant="group-title"
          size="xs"
          role="note"
          aria-description={t(`sidebar.groups.${group.title}`, {
            defaultValue: group.title,
          })}
          tabIndex={0}
        >
          <Trans
            i18nKey={`sidebar.groups.${group.title}`}
            defaults={group.title}
          />
        </Label>

        <ul>
          {group.conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              onSelect={onItemSelect}
            />
          ))}
        </ul>
      </div>
    );
  }
);
