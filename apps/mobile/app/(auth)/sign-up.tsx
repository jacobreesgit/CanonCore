import { useState } from "react";
import { Alert } from "react-native";
import { View, Text, TextInput, Pressable, ScrollView } from "@/tw";
import { Link } from "@/tw";
import { useTRPC } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";

export default function SignUpScreen() {
  const trpc = useTRPC();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const signUpMutation = useMutation(
    trpc.auth.signUp.mutationOptions({
      onSuccess: () => {
        Alert.alert(
          "Account Created",
          "Check your email to verify your account, then sign in.",
          [{ text: "OK", onPress: () => router.replace("/sign-in") }]
        );
      },
      onError: (error) => {
        Alert.alert("Sign Up Failed", error.message);
      },
    })
  );

  const handleSignUp = () => {
    if (!email || !username || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    signUpMutation.mutate({ email, username, password });
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
          Create account
        </Text>
        <Text className="text-muted-foreground">
          Join CanonCore
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
          <Text className="text-sm text-muted-foreground">Username</Text>
          <TextInput
            className="bg-secondary text-foreground rounded-lg p-3 text-base"
            placeholder="username"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            textContentType="username"
            autoComplete="username-new"
            style={{ borderCurve: "continuous" }}
          />
        </View>

        <View className="gap-2">
          <Text className="text-sm text-muted-foreground">Password</Text>
          <TextInput
            className="bg-secondary text-foreground rounded-lg p-3 text-base"
            placeholder="8+ characters"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="password-new"
            style={{ borderCurve: "continuous" }}
          />
        </View>

        <Pressable
          className="bg-primary rounded-lg p-3 items-center"
          onPress={handleSignUp}
          disabled={signUpMutation.isPending}
          style={{ borderCurve: "continuous" }}
        >
          <Text className="text-primary-foreground font-semibold text-base">
            {signUpMutation.isPending ? "Creating..." : "Create Account"}
          </Text>
        </Pressable>
      </View>

      <Link href="/sign-in" className="p-2 items-center self-center">
        <Text className="text-foreground text-sm">
          Already have an account?{" "}
          <Text className="text-primary font-semibold">Sign In</Text>
        </Text>
      </Link>
    </ScrollView>
  );
}
