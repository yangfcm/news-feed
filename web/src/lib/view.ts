export const VIEWS = ["article", "card", "list"] as const;

export type View = (typeof VIEWS)[number];

/** Date pages and source pages remember their view separately. */
export type ViewScope = "date" | "source";

export const DEFAULT_VIEW: View = "article";

export const VIEW_STORAGE_KEYS: Record<ViewScope, string> = { date: "view:date", source: "view:source" };

export const VIEW_ATTRIBUTES: Record<ViewScope, string> = { date: "data-date-view", source: "data-source-view" };

/** Which of a scope's panels each view shows, keyed on the <html> attribute. */
export const VIEW_PANEL_CLASSES: Record<ViewScope, Record<View, string>> = {
  date: {
    article: "in-data-[date-view=card]:hidden in-data-[date-view=list]:hidden",
    card: "hidden in-data-[date-view=card]:block",
    list: "hidden in-data-[date-view=list]:block",
  },
  source: {
    article: "in-data-[source-view=card]:hidden in-data-[source-view=list]:hidden",
    card: "hidden in-data-[source-view=card]:block",
    list: "hidden in-data-[source-view=list]:block",
  },
};

const scopes = Object.keys(VIEW_STORAGE_KEYS) as ViewScope[];

// Inlined into <head> so the saved views are applied before first paint.
export const viewScript = `(function(){try{var v=${JSON.stringify(VIEWS)},d=document.documentElement;${scopes
  .map(
    (scope) =>
      `var ${scope}=localStorage.getItem("${VIEW_STORAGE_KEYS[scope]}");d.setAttribute("${VIEW_ATTRIBUTES[scope]}",v.indexOf(${scope})<0?"${DEFAULT_VIEW}":${scope});`,
  )
  .join("")}}catch(e){}})()`;
