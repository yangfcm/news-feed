export const THEME_COLORS = ["default", "red", "orange", "yellow", "green", "blue", "indigo", "violet"] as const;

export type ThemeColor = (typeof THEME_COLORS)[number];

export const DEFAULT_THEME_COLOR: ThemeColor = "default";

export const THEME_COLOR_STORAGE_KEY = "theme-color";

export const THEME_COLOR_ATTRIBUTE = "data-theme-color";

// Inlined into <head> so the saved theme color is applied before first paint.
export const themeColorScript = `(function(){try{var c=localStorage.getItem("${THEME_COLOR_STORAGE_KEY}");if(c!=="${DEFAULT_THEME_COLOR}"&&${JSON.stringify(THEME_COLORS)}.indexOf(c)>=0)document.documentElement.setAttribute("${THEME_COLOR_ATTRIBUTE}",c)}catch(e){}})()`;
