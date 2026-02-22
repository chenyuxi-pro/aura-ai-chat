import { lightTheme } from "./light.css.js";
import { darkTheme } from "./dark.css.js";
import { professionalLightTheme } from "./professional-light.css.js";

export { lightTheme } from "./light.css.js";
export { darkTheme } from "./dark.css.js";
export { professionalLightTheme } from "./professional-light.css.js";

export type AuraTheme = "light" | "dark" | "professional-light" | "auto";

export const themes = {
  light: lightTheme,
  dark: darkTheme,
  "professional-light": professionalLightTheme,
};
