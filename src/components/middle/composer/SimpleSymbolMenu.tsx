import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useLayoutEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiSticker, ApiVideo } from '../../../api/types';
import type { GlobalActions } from '../../../global';
import type { ThreadId } from '../../../types';
import type { MenuPositionOptions } from '../../ui/Menu';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { selectIsContextMenuTranslucent, selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';

import useAppLayout from '../../../hooks/useAppLayout';
import useLastCallback from '../../../hooks/useLastCallback';
import useMouseInside from '../../../hooks/useMouseInside';
import useOldLang from '../../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Menu from '../../ui/Menu';
import Portal from '../../ui/Portal';
import Transition from '../../ui/Transition';
import EmojiPicker from './EmojiPicker';
import SymbolMenuFooter, { SYMBOL_MENU_TAB_TITLES } from './SymbolMenuFooter';

import './SymbolMenu.scss';

const ANIMATION_DURATION = 350;

export type OwnProps = {
  isOpen: boolean;
  isMessageComposer?: boolean;
  onLoad: () => void;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  onRemoveSymbol: () => void;
  onSearchOpen: (type: 'stickers' | 'gifs') => void;
  addRecentEmoji: GlobalActions['addRecentEmoji'];
  className?: string;
  // isAttachmentModal?: boolean;
}
& MenuPositionOptions;

type StateProps = {
  isLeftColumnShown: boolean;
  isBackgroundTranslucent?: boolean;
};

let isActivated = false;

const SimpleSymbolMenu: FC<OwnProps & StateProps> = ({
  isOpen,
  isMessageComposer,
  isLeftColumnShown,
  className,
  onLoad,
  onClose,
  onEmojiSelect,
  onRemoveSymbol,
  addRecentEmoji,
  // ...menuPositionOptions
}) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const { isMobile } = useAppLayout();

  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose, undefined, isMobile);
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen, onClose, false, false);

  const lang = useOldLang();

  const isAttachmentModal = false;

  if (!isActivated && isOpen) {
    isActivated = true;
  }

  useEffect(() => {
    onLoad();
  }, [onLoad]);

  useLayoutEffect(() => {
    if (!isMobile || !isOpen || isAttachmentModal) {
      return undefined;
    }

    document.body.classList.add('enable-symbol-menu-transforms');
    document.body.classList.add('is-symbol-menu-open');

    return () => {
      document.body.classList.remove('is-symbol-menu-open');

      setTimeout(() => {
        requestMutation(() => {
          document.body.classList.remove('enable-symbol-menu-transforms');
        });
      }, ANIMATION_DURATION);
    };
  }, [isAttachmentModal, isMobile, isOpen]);

  const recentEmojisRef = useRef(recentEmojis);
  recentEmojisRef.current = recentEmojis;
  useEffect(() => {
    if (!recentEmojisRef.current.length || isOpen) {
      return;
    }

    recentEmojisRef.current.forEach((name) => {
      addRecentEmoji({ emoji: name });
    });

    setRecentEmojis([]);
  }, [isOpen, addRecentEmoji]);

  const handleEmojiSelect = useLastCallback((emoji: string, name: string) => {
    setRecentEmojis((emojis) => [...emojis, name]);

    onEmojiSelect(emoji);
  });

  function renderContent() {
    return (
      <EmojiPicker
        className="picker-tab"
        onEmojiSelect={handleEmojiSelect}
      />
    );
  }

  function stopPropagation(event: any) {
    event.stopPropagation();
  }

  const content = (
    <>
      <div className="SymbolMenu-main" onClick={stopPropagation}>
        {isActivated && (
          <Transition
            name="slide"
            activeKey={activeTab}
            renderCount={Object.values(SYMBOL_MENU_TAB_TITLES).length}
          >
            {renderContent}
          </Transition>
        )}
      </div>
      {isMobile && (
        <Button
          round
          faded
          color="translucent"
          ariaLabel={lang('Close')}
          className="symbol-close-button"
          size="tiny"
          onClick={onClose}
        >
          <Icon name="close" />
        </Button>
      )}
      <SymbolMenuFooter
        activeTab={activeTab}
        onSwitchTab={setActiveTab}
        onRemoveSymbol={onRemoveSymbol}
        canSearch={false}
        onSearchOpen={() => { console.log('open'); }}
        isAttachmentModal={false}
        canSendPlainText={true}
      />
    </>
  );

  if (isMobile) {
    if (!shouldRender) {
      return undefined;
    }

    const mobileClassName = buildClassName(
      'SimpleSymbolMenu mobile-menu',
      transitionClassNames,
      isLeftColumnShown && 'left-column-open',
      isAttachmentModal && 'in-attachment-modal',
      isMessageComposer && 'in-middle-column',
    );

    if (isAttachmentModal) {
      return (
        <div className={mobileClassName}>
          {content}
        </div>
      );
    }

    return (
      <Portal>
        <div className={mobileClassName}>
          {content}
        </div>
      </Portal>
    );
  }

  return (
    <Menu
      isOpen={isOpen}
      onClose={onClose}
      withPortal={true}
      className={buildClassName('SymbolMenu', className)}
      onCloseAnimationEnd={onClose}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCloseOnBackdrop={!IS_TOUCH_ENV}
      noCompact={true}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...({
        positionX: 'left',
        positionY: 'top',
        style: 'margin: 10rem 0px 0px 10rem',
      })}
    >
      {content}
    </Menu>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      isLeftColumnShown: selectTabState(global).isLeftColumnShown,
      isBackgroundTranslucent: selectIsContextMenuTranslucent(global),
    };
  },
)(SimpleSymbolMenu));
