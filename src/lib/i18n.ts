import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en.json";
import hi from "@/locales/hi.json";
import ja from "@/locales/ja.json";
import ko from "@/locales/ko.json";
import zh from "@/locales/zh.json";

/**
 * Mobile i18n setup -- same design as the portal: no device-locale
 * auto-detection, no full language picker in-app. The employee's display
 * language is DECIDED by their company (set via the dashboard's
 * Invite/Employee Detail pages, or self-toggled back to English in the
 * app's own Settings). All 5 locale resources are registered here
 * regardless, since an employee could be assigned any one of them.
 *
 * The ACTIVE language is set at runtime once GET /me resolves inside
 * AuthProvider -- see auth.tsx, which calls i18n.changeLanguage() as soon
 * as `me.language` is known, both on cold-start session restore and after
 * a fresh sign-in.
 */
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ja: { translation: ja },
    ko: { translation: ko },
    zh: { translation: zh },
    hi: { translation: hi },
  },
  lng: "en", // placeholder until AuthProvider syncs the real value
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  // React Native has no risk of XSS via innerHTML the way web does, but
  // escapeValue: false is still correct here -- it's about not
  // double-escaping characters like apostrophes in interpolated values,
  // not a web-specific security setting.
  compatibilityJSON: "v4",
});

export default i18n;