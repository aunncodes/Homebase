import type {HomebaseThemeId} from '../types/storage';

interface ThemeOption {
  id: HomebaseThemeId;
  name: string;
  swatches: [string, string, string, string];
}

export const defaultThemeId: HomebaseThemeId = 'light';

export const themes: ThemeOption[] = [
  {
    id: 'light',
    name: 'Light',
    swatches: ['#f7eddc', '#ddebdc', '#d1e4ea', '#244f65'],
  },
  {
    id: 'green',
    name: 'Green',
    swatches: ['#edf2df', '#cddfc8', '#8eb6a0', '#315f54'],
  },
  {
    id: 'purple',
    name: 'Purple',
    swatches: ['#f2dfd7', '#d7c5e6', '#b6c6e9', '#51406f'],
  },
  {
    id: 'dark',
    name: 'Dark',
    swatches: ['#d8eee5', '#b8d4dd', '#24384c', '#f5d778'],
  },
  {
    id: 'warm',
    name: 'Warm',
    swatches: ['#fff0b8', '#f3b26f', '#b5d7c1', '#3f6163'],
  },
];
