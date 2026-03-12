import { useState } from "react";
import { View, Text, Pressable } from "@/tw";
import { ContentsTab } from "./contents-tab";
import { AboutTab } from "./about-tab";
import { FilesList } from "./files-list";

interface FileItem {
  id: string;
  filename: string;
  fileType: "MEDIA" | "ARTWORK" | "SUBTITLE";
  mimeType: string | null;
  size: number | null;
  isPrimary: boolean;
  isHero: boolean;
  durationMs: number | null;
  width: number | null;
  height: number | null;
}

type TabKey = "contents" | "about" | "files";

interface ItemDetailTabsProps {
  itemId: string;
  hasChildren: boolean;
  description: string | null;
  genres: string[];
  tagline: string | null;
  year: string | null;
  runtime: string | null;
  files: FileItem[];
  onFilePress?: (file: FileItem) => void;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "contents", label: "Contents" },
  { key: "about", label: "About" },
  { key: "files", label: "Files" },
];

export function ItemDetailTabs({
  itemId,
  hasChildren,
  description,
  genres,
  tagline,
  year,
  runtime,
  files,
  onFilePress,
}: ItemDetailTabsProps) {
  // Default to "contents" if item has children, else "about"
  const [activeTab, setActiveTab] = useState<TabKey>(
    hasChildren ? "contents" : description ? "about" : "files"
  );

  return (
    <View className="flex-1">
      {/* Tab bar */}
      <View className="flex-row border-b border-border">
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className="flex-1 items-center py-3"
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === tab.key
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </Text>
            {activeTab === tab.key ? (
              <View className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
            ) : null}
          </Pressable>
        ))}
      </View>

      {/* Tab content */}
      <View className="flex-1">
        {activeTab === "contents" ? (
          <ContentsTab parentId={itemId} />
        ) : activeTab === "about" ? (
          <AboutTab
            description={description}
            genres={genres}
            tagline={tagline}
            year={year}
            runtime={runtime}
          />
        ) : (
          <FilesList files={files} onFilePress={onFilePress} />
        )}
      </View>
    </View>
  );
}
