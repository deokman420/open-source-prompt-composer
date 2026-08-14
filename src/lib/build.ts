/**
 * Build identity, shared by the footer stamp and the asset cache buster.
 */

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
export const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE ?? "";

/** Changes on every deploy. See NEXT_PUBLIC_ASSET_VERSION in next.config.mjs. */
export const ASSET_VERSION = process.env.NEXT_PUBLIC_ASSET_VERSION ?? "dev";

/**
 * The vanilla composer bundle and its stylesheet.
 *
 * These live here, not in ComposerHost, because /compose is a server component
 * that needs the same paths for its preload hints. Every export of a
 * "use client" module is a client reference on the server, so importing a plain
 * string from one yields a throwing proxy rather than the string.
 */
export const COMPOSER_BUNDLE = "/composer/app.js";
export const COMPOSER_STYLES = "/composer/style.css";

/**
 * Version-stamp a fixed-path asset out of /public.
 *
 * Only for files Next does not fingerprint itself — today that is the composer
 * bundle and its stylesheet. Anything imported through the bundler already gets
 * a content-hashed URL and must not go through here.
 *
 * The stamp has to be identical on the server and the client: the preload hint
 * is rendered during SSR and the <script> is created after hydration, and two
 * different URLs would fetch the file twice.
 */
export function versioned(path: string): string {
  return `${path}?v=${encodeURIComponent(ASSET_VERSION)}`;
}
