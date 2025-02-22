import React, { memo, useEffect, useRef, useState } from '../../../lib/teact/teact';
import { getActions } from '../../../global';
import type { ApiSticker } from '../../../api/types';
import type { IAnchorPosition } from '../../../types';

import buildClassName from '../../../util/buildClassName';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Spinner from '../../ui/Spinner';
import SimpleSymbolMenu from "./SimpleSymbolMenu.async";
import renderText from "../../common/helpers/renderText";

const MOBILE_KEYBOARD_HIDE_DELAY_MS = 100;

type OwnProps = {
  isReady: boolean;
  isMobile?: boolean;
  titleEmoji?: string;
  isSymbolMenuOpen: boolean;
  openSymbolMenu: VoidFunction;
  closeSymbolMenu: VoidFunction;
  onCustomEmojiSelect: (emoji: ApiSticker) => void;
  onRemoveSymbol: VoidFunction;
  onEmojiSelect: (emoji: string) => void;
  className?: string;
};

const SimpleSymbolMenuButton: React.FC<OwnProps> = ({
  isReady,
  isMobile,
  isSymbolMenuOpen = false,
  className,
  titleEmoji,
  openSymbolMenu,
  closeSymbolMenu,
  onCustomEmojiSelect,
  onRemoveSymbol,
  onEmojiSelect,
}) => {
  const { addRecentEmoji } = getActions();

  const [isSymbolMenuLoaded, onSymbolMenuLoadingComplete] = useFlag();

  const symbolMenuButtonClassName = buildClassName(
    'mobile-symbol-menu-button',
    !isReady && 'not-ready',
    isSymbolMenuLoaded ? (isSymbolMenuOpen && 'menu-opened') : (isSymbolMenuOpen && 'is-loading'),
  );

  const handleSymbolMenuOpen = useLastCallback(() => {
    if (!isMobile) {
      openSymbolMenu();
      return;
    }
    setTimeout(() => {
      openSymbolMenu();
    }, MOBILE_KEYBOARD_HIDE_DELAY_MS);
  });

  const [latestEmoji, setLatestEmoji] = useState<string | undefined>(undefined);

  const handleOnEmojiSelect = useLastCallback((emoji: string) => {
    setLatestEmoji(emoji);
    onEmojiSelect(emoji);
  });

  // Reference for the span that will display emoji HTML
  const emojiSpanRef = useRef<HTMLSpanElement>(null);

  // Update the innerHTML of the span when latestEmoji changes.
  useEffect(() => {
    if (titleEmoji && emojiSpanRef.current) {
      emojiSpanRef.current.innerHTML = renderText(titleEmoji, ['emoji_html']).join('');
    }
    // if (latestEmoji && emojiSpanRef.current) {
    //   emojiSpanRef.current.innerHTML = renderText(latestEmoji, ['emoji_html']).join('');
    // }
  }, [latestEmoji, titleEmoji]);

  return (
    <>
      <Button
        className={symbolMenuButtonClassName}
        round
        color="translucent"
        onClick={isSymbolMenuOpen ? closeSymbolMenu : handleSymbolMenuOpen}
        ariaLabel="Choose emoji"
      >
        {titleEmoji ? (
          // The span whose innerHTML we update to render the emoji HTML.
          <span ref={emojiSpanRef} />
        ) : (
          // If no emoji is set, render the Icon component.
          <Icon name="folder" />
        )}
        {isSymbolMenuOpen && !isSymbolMenuLoaded && <Spinner color="gray" />}
      </Button>

      <SimpleSymbolMenu
        isOpen={isSymbolMenuOpen}
        onLoad={onSymbolMenuLoadingComplete}
        onClose={closeSymbolMenu}
        onEmojiSelect={handleOnEmojiSelect}
        onRemoveSymbol={onRemoveSymbol}
        addRecentEmoji={addRecentEmoji}
        onSearchOpen={() => console.log('search open')}
      />
    </>
  );
};

export default memo(SimpleSymbolMenuButton);
