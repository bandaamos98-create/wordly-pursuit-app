import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

type ThemeCtx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: "light" | "dark";
};

const Ctx = createContext<ThemeCtx | undefined>(undefined);

function applyTheme(t: Theme) {
  const root = document.documentElement;
  const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = t === "dark" || (t === "system" && sysDark);
  root.classList.toggle("dark", dark);
  return dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem("wp-theme") as Theme) || "system";
  });
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    setResolved(applyTheme(theme) as "light" | "dark");
    localStorage.setItem("wp-theme", theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(applyTheme("system") as "light" | "dark");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <Ctx.Provider value={{ theme, setTheme: setThemeState, resolved }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be used inside ThemeProvider");
  return c;
}