export const THEME_STORAGE_KEY = "theme";
export const SIDEBAR_STORAGE_KEY = "admin-sidebar";

/**
 * Runs before first paint (rendered into <head> by the root layout) and applies
 * saved UI preferences so the page never flashes the wrong state:
 * - theme: saved choice, else the system preference → <html data-theme>
 * - admin sidebar: "collapsed" → <html data-sidebar="collapsed">
 */
const script = `(function(){var d=document.documentElement;try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.setAttribute("data-theme",t);if(localStorage.getItem(${JSON.stringify(SIDEBAR_STORAGE_KEY)})==="collapsed")d.setAttribute("data-sidebar","collapsed")}catch(e){d.setAttribute("data-theme","light")}})();`;

export function PreferencesScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
