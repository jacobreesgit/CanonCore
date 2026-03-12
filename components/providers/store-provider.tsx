"use client";

import { useState } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "@/lib/store";

/**
 * Redux store provider for Next.js App Router.
 * Uses useState with lazy initializer to create the store once per lifecycle.
 * (useRef pattern conflicts with React Compiler's refs-during-render rule.)
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState<AppStore>(() => makeStore());

  return <Provider store={store}>{children}</Provider>;
}
