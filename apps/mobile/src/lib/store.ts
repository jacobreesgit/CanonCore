import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import playbackReducer from "@canoncore/store/playback";
import uiPrefsReducer from "@canoncore/store/ui-prefs";
import { reduxStorage } from "./mmkv";

const persistConfig = {
  key: "root",
  storage: reduxStorage,
  whitelist: ["uiPrefs"],
};

const playbackPersistConfig = {
  key: "playback",
  storage: reduxStorage,
  whitelist: ["repeatMode", "shuffleEnabled"],
};

const rootReducer = combineReducers({
  playback: persistReducer(playbackPersistConfig, playbackReducer),
  uiPrefs: uiPrefsReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
