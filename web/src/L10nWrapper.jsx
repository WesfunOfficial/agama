/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

// @ts-check

import { useEffect, useState } from "react";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import cockpit from "./lib/cockpit";

/**
 * Helper function for storing the Cockpit language.
 * @param {String} lang the new language tag (like "cs", "cs-cz",...)
 */
function storeLanguage(lang) {
  // code taken from Cockpit
  const cookie = "CockpitLang=" + encodeURIComponent(lang) + "; path=/; expires=Sun, 16 Jul 3567 06:23:41 GMT";
  document.cookie = cookie;
  window.localStorage.setItem("cockpit.lang", lang);
}

/**
 * Helper function for reloading the page.
 */
function reload() {
  window.location.reload();
}

/**
 * This is a helper component to set the language. It uses the
 * URL "lang" query parameter or the preferred language from the browser and
 * synchronizes the UI and the backend languages
 * To activate a new language it reloads the whole page.
 *
 * It behaves like a wrapper, it just wraps the children components, it does
 * not render any real content.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.children] - content to display within the wrapper
 */
export default function L10nWrapper({ children }) {
  const [language, setLanguage] = useState(undefined);
  const { language: client } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // language from cookie, empty string if not set (regexp taken from Cockpit)
    const langCookie = decodeURIComponent(document.cookie.replace(/(?:(?:^|.*;\s*)CockpitLang\s*=\s*([^;]*).*$)|^.*$/, "$1"));
    // "lang" query parameter from the URL, null if not set
    let langQuery = (new URLSearchParams(window.location.search)).get("lang");

    // set the language from the URL query
    if (langQuery) {
      // convert "pt_BR" to Cockpit compatible "pt-br"
      langQuery = langQuery.toLowerCase().replace("_", "-");

      // special handling for the testing "xx" language
      if (langQuery === "xx" || langQuery === "xx-xx") {
        // just activate the language, there are no real translations to load
        cockpit.language = "xx";
      } else if (langCookie !== langQuery) {
        storeLanguage(langQuery);
        reload();
      }
      setLanguage(langQuery);
    } else {
      // if the language has not been configured yet use the preferred language
      // from the browser, so far do it only in the development mode because there
      // are not enough translations available
      //
      // TODO: use the navigator.languages list to find a supported language, the
      // first preferred language might not be supported by Agama
      if (process.env.NODE_ENV !== "production" && langCookie === "" && navigator.language) {
        // convert browser language "pt-BR" to Cockpit compatible "pt-br"
        storeLanguage(navigator.language.toLowerCase());
        reload();
      }
      setLanguage(langCookie);
    }
  }, []);

  useEffect(() => {
    const syncBackendLanguage = async () => {
      // cockpit uses "pt-br" format, convert that to the usual Linux locale "pt_BR" style
      let [lang, country] = cockpit.language.split("-");
      country = country?.toUpperCase();
      const cockpitLocale = lang + (country ? "_" + country : "");
      const currentLang = await cancellablePromise(client.getUILanguage());

      if (currentLang !== cockpitLocale) {
        console.log("setUILanguage");
        await cancellablePromise(client.setUILanguage(cockpitLocale));
        // reload the whole page to force retranslation of all texts
        window.location.reload();
      }
    };

    if (language) {
      syncBackendLanguage().catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [client, cancellablePromise, language]);

  if (loading) {
    return null;
  }

  return children;
}
