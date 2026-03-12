import { useState } from "react";
import { Alert } from "react-native";
import { View, Text, TextInput, Pressable, ScrollView } from "@/tw";
import { Link } from "@/tw";
export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);

  // TODO: Replace with trpc.auth.signIn mutation when JWT auth is added to the auth router
  const handleSignIn = () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setIsPending(true);
    Alert.alert(
      "Not Implemented",
      "Sign-in requires a JWT auth endpoint. Coming in a future plan.",
      [{ text: "OK", onPress: () => setIsPending(false) }]
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-5 gap-6 justify-center flex-1"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-2">
        <Text className="text-3xl font-bold text-foreground">
          Welcome back
        </Text>
        <Text className="text-muted-foreground">
          Sign in to your CanonCore account
        </Text>
      </View>

      <View className="gap-4">
        <View className="gap-2">
          <Text className="text-sm text-muted-foreground">Email</Text>
          <TextInput
            className="bg-secondary text-foreground rounded-lg p-3 text-base"
            placeholder="you@example.com"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            style={{ borderCurve: "continuous" }}
          />
        </View>

        <View className="gap-2">
          <Text className="text-sm text-muted-foreground">Password</Text>
          <TextInput
            className="bg-secondary text-foreground rounded-lg p-3 text-base"
            placeholder="Password"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            autoComplete="password"
            style={{ borderCurve: "continuous" }}
          />
        </View>

        <Pressable
          className="bg-primary rounded-lg p-3 items-center"
          onPress={handleSignIn}
          disabled={isPending}
          style={{ borderCurve: "continuous" }}
        >
          <Text className="text-primary-foreground font-semibold text-base">
            {isPending ? "Signing in..." : "Sign In"}
          </Text>
        </Pressable>
      </View>

      <View className="gap-3 items-center">
        <Link href="/forgot-password" className="p-2">
          <Text className="text-muted-foreground text-sm">
            Forgot password?
          </Text>
        </Link>
        <Link href="/sign-up" className="p-2">
          <Text className="text-foreground text-sm">
            Don't have an account?{" "}
            <Text className="text-primary font-semibold">Sign Up</Text>
          </Text>
        </Link>
      </View>
    </ScrollView>
  );
}
