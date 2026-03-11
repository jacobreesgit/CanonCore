/**
 * Typed Redux hooks.
 * Import from here in components (not from store/index.ts) to keep
 * server-importable types separate from client-only react-redux hooks.
 */

import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./index";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
