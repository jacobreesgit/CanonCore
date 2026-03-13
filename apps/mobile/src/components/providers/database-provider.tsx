import { createContext, useContext, useMemo, type ReactNode } from "react";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { migrateDatabase } from "@/db/schema";
import { DownloadDAO } from "@/db/download-dao";

const DAOContext = createContext<DownloadDAO | null>(null);

/**
 * Provides the SQLite database and DownloadDAO to the component tree.
 * Must be rendered inside the app's provider hierarchy.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName="canoncore.db" onInit={migrateDatabase}>
      <DAOProvider>{children}</DAOProvider>
    </SQLiteProvider>
  );
}

function DAOProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const dao = useMemo(() => new DownloadDAO(db), [db]);

  return <DAOContext.Provider value={dao}>{children}</DAOContext.Provider>;
}

/**
 * Access the DownloadDAO from any component.
 * Must be used within DatabaseProvider.
 */
export function useDownloadDAO(): DownloadDAO {
  const dao = useContext(DAOContext);
  if (!dao) {
    throw new Error("useDownloadDAO must be used within DatabaseProvider");
  }
  return dao;
}
