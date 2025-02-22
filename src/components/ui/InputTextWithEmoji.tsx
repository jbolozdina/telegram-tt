import type {
  ChangeEvent, FormEvent, RefObject,
} from 'react';
import {FC, useState, useEffect} from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useOldLang from '../../hooks/useOldLang';
import EmojiPicker from '../middle/composer/EmojiPicker';
import SimpleSymbolMenu from '../middle/composer/SimpleSymbolMenu';
import SimpleSymbolMenuButton from "../middle/composer/SimpleSymbolMenuButton";
import useFlag from "../../hooks/useFlag";
import renderText from "../common/helpers/renderText";

import './InputTextWithEmoji.scss';

import EMOJI_REGEX from '../../lib/twemojiRegex';

type OwnProps = {
  ref?: RefObject<HTMLInputElement>;
  id?: string;
  className?: string;
  value?: string;
  label?: string;
  error?: string;
  success?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  tabIndex?: number;
  teactExperimentControlled?: boolean;
  inputMode?: 'text' | 'none' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onInput?: (e: FormEvent<HTMLInputElement>) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
};

const InputText: FC<OwnProps> = ({
  ref,
  id,
  className,
  value,
  label,
  error,
  success,
  disabled,
  readOnly,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  tabIndex,
  teactExperimentControlled,
  onChange,
  onInput,
  onKeyPress,
  onKeyDown,
  onBlur,
  onPaste,
}) => {
  const lang = useOldLang();
  const labelText = error || success || label;
  const fullClassName = buildClassName(
    'input-group',
    value && 'touched',
    error ? 'error' : success && 'success',
    disabled && 'disabled',
    readOnly && 'disabled',
    labelText && 'with-label',
    className,
  );

  // This function will handle emoji selection and append the selected emoji to the current value.
  const insertEmoji = (emoji: string): void => {
    if (onChange) {
      const emojiCut = value?.split(EMOJI_REGEX);

      let newValue = value;
      if (emojiCut && emojiCut.length > 2) {
        for (let i = 0; i < (emojiCut.length); i++) {
          if (emojiCut[i] && !EMOJI_REGEX.test(emojiCut[i])) {
            newValue = emojiCut[i];
            break;
          }
        }

        newValue = newValue || '';
      }

      onChange({ currentTarget: { value: emoji + newValue } } as ChangeEvent<HTMLInputElement>);
    }
  };

  const getTitleEmoji = (): string => {
    if (!value) return '';

    const match = value.match(EMOJI_REGEX);
    return match ? match[0] : '';
  };

  // New state variable to hold the title emoji
  const [titleEmoji, setTitleEmoji] = useState<string>(getTitleEmoji());

  // Updates titleEmoji every time the value changes by extracting the first emoji using EMOJI_REGEX.
  useEffect(() => {
    if (value) {
      const match = value.match(EMOJI_REGEX);
      setTitleEmoji(match ? match[0] : '');
    } else {
      setTitleEmoji('');
    }
  }, [value]);


  const [isSymbolMenuOpen, openSymbolMenu, closeSymbolMenu] = useFlag(false);

  return (
    <div className={fullClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      <div
        className="emoji-button-container"
      >
        <SimpleSymbolMenuButton
          // className="attachment-modal-symbol-menu"
          isSymbolMenuOpen={isSymbolMenuOpen}
          titleEmoji={titleEmoji}
          openSymbolMenu={openSymbolMenu}
          closeSymbolMenu={closeSymbolMenu}
          onClose={ () => console.log('closed') }
          onLoad={() => { console.log('loaded'); }}
          onEmojiSelect={insertEmoji}
          addRecentEmoji={ (emoji) => console.log('latest emoji: ', emoji) }
          onRemoveSymbol={ () => console.log('remove symbol')}
          onSearchOpen={ () => console.log('search open')}
        />
      </div>
      <input
        ref={ref}
        className="form-control"
        type="text"
        id={id}
        dir="auto"
        value={value || ''}
        tabIndex={tabIndex}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        readOnly={readOnly}
        onChange={onChange}
        onInput={onInput}
        onKeyPress={onKeyPress}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onPaste={onPaste}
        aria-label={labelText}
        teactExperimentControlled={teactExperimentControlled}
        style="padding-right: 3rem;"
      />
      {labelText && (
        <label htmlFor={id}>{labelText}</label>
      )}
    </div>
  );
};

export default memo(InputText);
