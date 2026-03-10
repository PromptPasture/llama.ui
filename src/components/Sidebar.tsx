import { useCallback, useMemo, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { LuSearch, LuSquarePen, LuX } from 'react-icons/lu';
import { useNavigate } from 'react-router';
import { useConversations } from '../hooks/useConversations';
import useFilter from '../hooks/useFilter';
import { groupConversationsByDate } from '../utils/conversation-grouper';
import { Button } from './Button';
import { ConversationGroup } from './ConversationGroup';
import { ConversationItem } from './ConversationItem';
import { Icon } from './Icon';
import { Input } from './Input';
import { Label } from './Label';

export default function Sidebar() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const toggleDrawerRef = useRef<HTMLInputElement>(null);

  const conversations = useConversations();

  const {
    filteredData: filteredConversations,
    setFilter,
    resetFilter,
    searchTerm,
    isFiltered,
  } = useFilter(conversations);

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
