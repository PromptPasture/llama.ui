import { memo, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Trans, useTranslation } from 'react-i18next';
import {
  LuDownload,
  LuEllipsisVertical,
  LuPencil,
  LuTrash,
} from 'react-icons/lu';
import { useNavigate } from 'react-router';
import IndexedDB from '../database/indexedDB';
import { useChatContext } from '../store/chat';
import { useModals } from '../store/modal';
import { Conversation } from '../types';
import { classNames } from '../utils/css-helpers';
import { downloadAsFile } from '../utils/downloadAsFile';
import { Button } from './Button';
import { Icon } from './Icon';

export const ConversationItem = memo(
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
