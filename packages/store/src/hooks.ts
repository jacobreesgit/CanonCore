/**
 * Typed Redux hooks.
 * Import from here in components (not from store/index.ts) to keep
 * server-importable types separate from client-only react-redux hooks.
 */

import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "./index";

// AppDispatch is derived from the combined reducer — for the shared package
// we type it as the dispatch for a store created with rootReducer.
// Apps can override this with their own store's dispatch type if needed.
import type { ThunkDispatch, UnknownAction } from "@reduxjs/toolkit";
type AppDispatch = ThunkDispatch<RootState, undefined, UnknownAction>;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
