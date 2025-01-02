import { defaultTheme, extendTheme } from '@inkjs/ui';
import type { TextProps } from 'ink';

export const COLOR_SUPABASE = '#3ecf8e';
export const COLOR_ACCENT = 'magenta';
export const COLOR_SUCCESS = 'green';
export const COLOR_ERROR = 'red';
export const COLOR_WARNING = 'yellow';
export const OPTION_COLOR_SELECTED = 'green';

export const customTheme = extendTheme(defaultTheme, {
  components: {
    Select: {
      styles: {
        focusIndicator: (): TextProps => ({
          color: COLOR_ACCENT,
          bold: true,
        }),
        label({ isSelected, isFocused }): TextProps {
          let color: string | undefined;
          let bold: boolean | undefined;

          if (isSelected && isFocused) {
            color = OPTION_COLOR_SELECTED;
            bold = true;
          } else if (isSelected) {
            color = OPTION_COLOR_SELECTED;
          } else if (isFocused) {
            color = COLOR_ACCENT;
          }

          return { color, bold };
        },
      },
    },
    MultiSelect: {
      styles: {
        focusIndicator: (): TextProps => ({
          color: COLOR_ACCENT,
          bold: true,
        }),
        label({ isFocused, isSelected }): TextProps {
          let color: string | undefined;
          let bold: boolean | undefined;

          if (isSelected && isFocused) {
            color = OPTION_COLOR_SELECTED;
            bold = true;
          } else if (isSelected) {
            color = OPTION_COLOR_SELECTED;
          } else if (isFocused) {
            color = COLOR_ACCENT;
          }

          return { color, bold };
        },
      },
    },
    Spinner: {
      styles: {
        frame: (): TextProps => ({
          color: COLOR_ACCENT,
        }),
      },
    },
  },
});
