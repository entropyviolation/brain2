/**
 * lib/nav-boot.ts — Stamp the saved app tab before first paint
 *
 * The static export's HTML always carries the fallback tab (Home). A blocking
 * head script copies `brain2-app-tab` (else `cogs-app-tab`) onto `<html
 * data-boot-tab>` so CSS can light that trigger before React hydrates. Demo
 * profile reads `brain2-demo-app-tab` only.
 */
export const NAV_BOOT_SCRIPT = `(function(){try{var demo=localStorage.getItem("brain2-data-profile")==="demo";var key=demo?"brain2-demo-app-tab":"brain2-app-tab";var tab=localStorage.getItem(key);if(!tab&&!demo)tab=localStorage.getItem("cogs-app-tab");if(tab)document.documentElement.setAttribute("data-boot-tab",tab);}catch(e){}})();`
