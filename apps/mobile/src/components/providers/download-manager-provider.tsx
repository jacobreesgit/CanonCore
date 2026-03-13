import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { DownloadManager } from "@/services/download-manager";
import { useDownloadDAO } from "./database-provider";

const DownloadManagerContext = createContext<DownloadManager | null>(null);

export function DownloadManagerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const dao = useDownloadDAO();
  const manager = useMemo(() => new DownloadManager(dao), [dao]);

  // Resume interrupted downloads on mount
  useEffect(() => {
    manager.resumeOnStart();
  }, [manager]);

  return (
    <DownloadManagerContext.Provider value={manager}>
      {children}
    </DownloadManagerContext.Provider>
  );
}

/**
 * Access the DownloadManager from any component.
 * Must be used within DownloadManagerProvider.
 */
export function useDownloadManager(): DownloadManager {
  const manager = useContext(DownloadManagerContext);
  if (!manager) {
    throw new Error(
      "useDownloadManager must be used within DownloadManagerProvider"
    );
  }
  return manager;
}
