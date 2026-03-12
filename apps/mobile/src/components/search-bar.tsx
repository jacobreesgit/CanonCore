import { View, TextInput, Pressable } from "@/tw";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChangeText,
  onClear,
  placeholder = "Search...",
}: SearchBarProps) {
  return (
    <View className="flex-row items-center bg-card rounded-lg px-3 py-2.5 gap-2 mx-4 mb-3">
      <FontAwesomeIcon
        icon={faMagnifyingGlass}
        size={14}
        color="rgba(255, 255, 255, 0.4)"
      />
      <TextInput
        className="flex-1 text-foreground text-base"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255, 255, 255, 0.4)"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable onPress={onClear} hitSlop={8}>
          <FontAwesomeIcon
            icon={faXmark}
            size={14}
            color="rgba(255, 255, 255, 0.4)"
          />
        </Pressable>
      ) : null}
    </View>
  );
}
