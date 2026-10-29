export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

// Inlined into <head> so the saved theme (or the system's) is applied before first paint.
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("${DARK_QUERY}").matches?"dark":"light";var d=document.documentElement;d.classList.toggle("dark",t==="dark");d.style.colorScheme=t}catch(e){}})()`;
