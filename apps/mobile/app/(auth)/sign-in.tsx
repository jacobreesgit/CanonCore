import { useState } from "react";
import { Alert } from "react-native";
import { View, Text, TextInput, Pressable, ScrollView } from "@/tw";
import { Link } from "@/tw";
import { useTRPC } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "@/ctx";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const trpc = useTRPC();
  const { signIn } = useSession();

  const signInMutation = useMutation(
    trpc.auth.signIn.mutationOptions({
      onSuccess: (data) => {
        signIn(data.token, data.user);
      },
      onError: (error) => {
        Alert.alert("Sign In Failed", error.message);
      },
    }),
  );

  const handleSignIn = () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    signInMutation.mutate({ email: email.trim().toLowerCase(), password });
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-5 gap-6 justify-center flex-1"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-2">
        <Text className="text-3xl font-bold text-foreground">Welcome back</Text>
        <Text className="text-muted-foreground">
          Sign in to your CanonCore account
        </Text>
      </View>

      <View className="gap-4">
        <View className="gap-2">
          <Text className="text-sm text-muted-foreground">Email</Text>
          <TextInput
            testID="email-input"
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
            testID="password-input"
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
          testID="sign-in-button"
          className="bg-primary rounded-lg p-3 items-center"
          onPress={handleSignIn}
          disabled={signInMutation.isPending}
          style={{ borderCurve: "continuous" }}
        >
          <Text className="text-primary-foreground font-semibold text-base">
            {signInMutation.isPending ? "Signing in..." : "Sign In"}
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
