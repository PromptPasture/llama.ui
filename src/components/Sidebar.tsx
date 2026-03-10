import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Trans, useTranslation } from 'react-i18next';
import {
  LuDownload,
  LuEllipsisVertical,
  LuPencil,
  LuSearch,
  LuSquarePen,
  LuTrash,
  LuX,
} from 'react-icons/lu';
import { useNavigate } from 'react-router';
import IndexedDB from '../database/indexedDB';
import useFilter from '../hooks/useFilter';
import { useChatContext } from '../store/chat';
import { useModals } from '../store/modal';
import { Conversation } from '../types';
import { classNames } from '../utils/css-helpers';
import { downloadAsFile } from '../utils/downloadAsFile';
import { Button } from './Button';
import { Icon } from './Icon';
import { Input } from './Input';
import { Label } from './Label';

export default function Sidebar() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const toggleDrawerRef = useRef<HTMLInputElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);

  const {
    filteredData: filteredConversations,
    setFilter,
    resetFilter,
    searchTerm,
    isFiltered,
  } = useFilter(conversations);

  useEffect(() => {
    const handleConversationChange = async () => {
      setConversations(await IndexedDB.getAllConversations());
    };
    IndexedDB.onConversationChanged(handleConversationChange);
    handleConversationChange();
    return () => {
      IndexedDB.offConversationChanged(handleConversationChange);
    };
  }, []);

  const groupedConv = useMemo(
    () => groupConversationsByDate(conversations, i18n.language),
    [i18n.language, conversations]
  );

  const handleSelect = useCallback(() => {
    const toggle = toggleDrawerRef.current;
    if (toggle != null) {
      toggle.click();
    }
  }, []);

  return (
    <>
      <Input
        id="toggle-drawer"
        type="checkbox"
        className="drawer-toggle"
        ref={toggleDrawerRef}
        aria-label="Toggle sidebar"
      />

      <div
        className="drawer-side fixed inset-0 w-full z-50"
        role="complementary"
        aria-label="Sidebar"
        tabIndex={0}
      >
        <div className="flex flex-col bg-base-300 h-full min-h-0 max-w-full w-96 xl:w-72 pb-4 px-4 xl:pl-2 xl:pr-0 shadow-xl/50">
          <div className="flex flex-row items-center justify-between xl:py-2">
            {/* close sidebar button */}
            <Label size="icon" className="max-xl:hidden" />
            <Label
              className="xl:hidden"
              variant="btn-ghost"
              size="icon-xl"
              htmlFor="toggle-drawer"
              role="button"
              title={t('sidebar.buttons.closeSideBar')}
              aria-label={t('sidebar.buttons.closeSideBar')}
              tabIndex={0}
            >
              <Icon size="md">
                <LuX />
              </Icon>
            </Label>

            <Label
              variant="fake-btn"
              className="font-bold tracking-wider leading-8"
              aria-label={import.meta.env.VITE_APP_NAME}
              role="button"
              onClick={() => navigate('/')}
            >
              {import.meta.env.VITE_APP_NAME}
            </Label>

            {/* new conversation button */}
            <Button
              variant="ghost"
              size="icon-xl"
              onClick={() => navigate('/')}
              title={t('header.buttons.newConv')}
              aria-label={t('header.ariaLabels.newConv')}
            >
              <Icon size="md">
                <LuSquarePen />
              </Icon>
            </Button>
          </div>

          {/* search conversation */}
          <div className="flex max-xl:mt-2 xl:px-2">
            <Label
              variant="input-bordered"
              className="h-8 inset-shadow-sm my-1.5 px-1.5"
            >
              <Icon size="md">
                <LuSearch />
              </Icon>
              <Input
                className="input-sm grow"
                name="Search"
                placeholder={t('sidebar.searchPlaceHolder')}
                value={searchTerm}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                  if (e.key === 'Escape' && !e.shiftKey) {
                    e.preventDefault();
                    resetFilter();
                  }
                }}
                autoFocus
              />
              {isFiltered && (
                <Button
                  variant="ghost"
                  size="icon-md"
                  onClick={resetFilter}
                  title={t('header.buttons.clear')}
                  aria-label={t('header.ariaLabels.clear')}
                >
                  <Icon size="md">
                    <LuX />
                  </Icon>
                </Button>
              )}
            </Label>
          </div>

          {/* scrollable conversation list */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            {!isFiltered &&
              groupedConv.map((group, idx) => (
                <ConversationGroup
                  className={idx > 0 ? 'mt-6' : 'mt-3'}
                  key={group.title}
                  group={group}
                  onItemSelect={handleSelect}
                />
              ))}

            {isFiltered &&
              filteredConversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  onSelect={handleSelect}
                />
              ))}
          </div>

          {/* Footer always at the bottom */}
          <div className="text-center text-xs opacity-75 mx-4 pt-4">
            <Trans i18nKey="sidebar.storageNote" />
          </div>
        </div>
      </div>
    </>
  );
}

const ConversationGroup = memo(
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
        {/* group name (by date) */}
        {/* we use btn class here to make sure that the padding/margin are aligned with the other items */}
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

const ConversationItem = memo(
  ({ conv, onSelect }: { conv: Conversation; onSelect: () => void }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { viewingChat, isGenerating } = useChatContext();
    const { showConfirm, showPrompt } = useModals();

    const isCurrent = useMemo(
      () => viewingChat?.conv?.id === conv.id,
      [conv.id, viewingChat?.conv?.id]
    );

    const isPending = useMemo(
      () => isGenerating(conv.id),
      [conv.id, isGenerating]
    );

    const handleSelect = () => {
      onSelect();
      navigate(`/chat/${conv.id}`);
    };

    const handleRename = async () => {
      if (isPending) {
        toast.error(t('sidebar.errors.renameOnGenerate'));
        return;
      }
      const newName = await showPrompt(t('sidebar.actions.newName'), conv.name);
      if (newName && newName.trim().length > 0) {
        IndexedDB.updateConversationName(conv.id, newName);
      }
    };

    const handleDownload = async () => {
      if (isPending) {
        toast.error(t('sidebar.errors.downloadOnGenerate'));
        return;
      }
      return IndexedDB.exportDB(conv.id).then((data) =>
        downloadAsFile(
          [JSON.stringify(data, null, 2)],
          `conversation_${conv.id}.json`
        )
      );
    };

    const handleDelete = async () => {
      if (isPending) {
        toast.error(t('sidebar.errors.deleteOnGenerate'));
        return;
      }
      if (await showConfirm(t('sidebar.actions.deleteConfirm'))) {
        toast.success(t('sidebar.actions.deleteSuccess'));
        IndexedDB.deleteConversation(conv.id);
        navigate('/');
      }
    };

    return (
      <li
        role="menuitem"
        tabIndex={0}
        aria-label={conv.name}
        className={classNames({
          'group flex flex-row btn btn-ghost h-9 justify-start items-center font-normal px-2 xl:pr-0': true,
          'btn-soft': isCurrent,
        })}
      >
        <button
          type="button"
          key={conv.id}
          className="w-full overflow-hidden truncate text-start"
          onClick={handleSelect}
          dir="auto"
          title={conv.name}
          aria-label={t('sidebar.ariaLabels.select', { name: conv.name })}
        >
          {conv.name}
        </button>

        <div tabIndex={0} className="dropdown dropdown-end">
          <Button
            // on mobile, we always show the ellipsis icon
            // on desktop, we only show it when the user hovers over the conversation item
            // we use opacity instead of hidden to avoid layout shift
            className="h-auto w-auto opacity-100 xl:opacity-20 group-hover:opacity-100 border-none"
            variant="ghost"
            size="icon"
            onClick={() => {}}
            title={t('sidebar.buttons.more')}
            aria-label={t('sidebar.ariaLabels.more')}
          >
            <Icon size="md">
              <LuEllipsisVertical />
            </Icon>
          </Button>
          {/* dropdown menu */}
          <ul
            aria-label={t('sidebar.ariaLabels.dropdown')}
            role="menu"
            tabIndex={-1}
            className="dropdown-content menu bg-base-100 rounded-box z-[1] p-2 shadow"
          >
            <li role="menuitem" tabIndex={0} onClick={handleRename}>
              <Button
                variant="menu-item"
                size="small"
                title={t('sidebar.buttons.rename')}
                aria-label={t('sidebar.ariaLabels.rename')}
              >
                <Icon size="sm">
                  <LuPencil />
                </Icon>
                <Trans i18nKey="sidebar.buttons.rename" />
              </Button>
            </li>
            <li role="menuitem" tabIndex={0} onClick={handleDownload}>
              <Button
                variant="menu-item"
                size="small"
                title={t('sidebar.buttons.download')}
                aria-label={t('sidebar.ariaLabels.download')}
              >
                <Icon size="sm">
                  <LuDownload />
                </Icon>
                <Trans i18nKey="sidebar.buttons.download" />
              </Button>
            </li>
            <li
              role="menuitem"
              tabIndex={0}
              className="text-error"
              onClick={handleDelete}
            >
              <Button
                variant="menu-item"
                size="small"
                title={t('sidebar.buttons.delete')}
                aria-label={t('sidebar.ariaLabels.delete')}
              >
                <Icon size="sm">
                  <LuTrash />
                </Icon>
                <Trans i18nKey="sidebar.buttons.delete" />
              </Button>
            </li>
          </ul>
        </div>
      </li>
    );
  }
);

// WARN: vibe code below

export interface GroupedConversations {
  title?: string;
  conversations: Conversation[];
}

// TODO @ngxson : add test for this function
// Group conversations by date
// - "Previous 7 Days"
// - "Previous 30 Days"
// - "Month Year" (e.g., "April 2023")
export function groupConversationsByDate(
  conversations: Conversation[],
  language: string = 'default'
): GroupedConversations[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const groups: { [key: string]: Conversation[] } = {
    Today: [],
    Yesterday: [],
    'Previous 7 Days': [],
    'Previous 30 Days': [],
  };
  const monthlyGroups: { [key: string]: Conversation[] } = {}; // Key format: "Month Year" e.g., "April 2023"

  // Sort conversations by lastModified date in descending order (newest first)
  // This helps when adding to groups, but the final output order of groups is fixed.
  const sortedConversations = [...conversations].sort(
    (a, b) => b.lastModified - a.lastModified
  );

  for (const conv of sortedConversations) {
    const convDate = new Date(conv.lastModified);

    if (convDate >= today) {
      groups['Today'].push(conv);
    } else if (convDate >= yesterday) {
      groups['Yesterday'].push(conv);
    } else if (convDate >= sevenDaysAgo) {
      groups['Previous 7 Days'].push(conv);
    } else if (convDate >= thirtyDaysAgo) {
      groups['Previous 30 Days'].push(conv);
    } else {
      const monthName = convDate.toLocaleString(language, { month: 'long' });
      const year = convDate.getFullYear();
      const monthYearKey = `${monthName} ${year}`;
      if (!monthlyGroups[monthYearKey]) {
        monthlyGroups[monthYearKey] = [];
      }
      monthlyGroups[monthYearKey].push(conv);
    }
  }

  const result: GroupedConversations[] = [];

  if (groups['Today'].length > 0) {
    result.push({
      title: 'Today',
      conversations: groups['Today'],
    });
  }

  if (groups['Yesterday'].length > 0) {
    result.push({
      title: 'Yesterday',
      conversations: groups['Yesterday'],
    });
  }

  if (groups['Previous 7 Days'].length > 0) {
    result.push({
      title: 'Previous 7 Days',
      conversations: groups['Previous 7 Days'],
    });
  }

  if (groups['Previous 30 Days'].length > 0) {
    result.push({
      title: 'Previous 30 Days',
      conversations: groups['Previous 30 Days'],
    });
  }

  // Sort monthly groups by date (most recent month first)
  const sortedMonthKeys = Object.keys(monthlyGroups).sort((a, b) => {
    const dateA = new Date(a); // "Month Year" can be parsed by Date constructor
    const dateB = new Date(b);
    return dateB.getTime() - dateA.getTime();
  });

  for (const monthKey of sortedMonthKeys) {
    if (monthlyGroups[monthKey].length > 0) {
      result.push({ title: monthKey, conversations: monthlyGroups[monthKey] });
    }
  }

  return result;
}
