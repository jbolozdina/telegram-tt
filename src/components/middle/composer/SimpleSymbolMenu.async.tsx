import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './SimpleSymbolMenu';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const SymbolMenuAsync: FC<OwnProps> = (props) => {
  const SimpleSymbolMenu = useModuleLoader(Bundles.Extra, 'SimpleSymbolMenu', !props.isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return (SimpleSymbolMenu ? <SimpleSymbolMenu {...props} /> : undefined);
};

export default SymbolMenuAsync;
