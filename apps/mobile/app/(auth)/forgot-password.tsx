import { useState } from "react";
import { Alert } from "react-native";
import { View, Text, TextInput, Pressable, ScrollView } from "@/tw";
import { useTRPC } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";

export default function ForgotPasswordScreen() {
  const trpc = useTRPC();
  const router = useRouter();
  const [email, setEmail] = useState("");

  const forgotMutation = useMutation(
    trpc.auth.forgotPassword.mutationOptions({
      onSuccess: () => {
        Alert.alert(
          "Email Sent",
          "If an account exists with that email, you'll receive a password reset link.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      },
      onError: (error) => {
        Alert.alert("Error", error.message);
      },
    })
  );

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-5 gap-6 justify-center flex-1"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-2">
        <Text className="text-3xl font-bold text-foreground">
          Reset password
        </Text>
        <Text className="text-muted-foreground">
          Enter your email and we'll send a reset link.
        </Text>
      </View>

      <View className="gap-4">
        <TextInput
          testID="forgot-email-input"
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

        <Pressable
          testID="forgot-submit-button"
          className="bg-primary rounded-lg p-3 items-center"
          onPress={() => forgotMutation.mutate({ email })}
          disabled={forgotMutation.isPending || !email}
          style={{ borderCurve: "continuous" }}
        >
          <Text className="text-primary-foreground font-semibold text-base">
            {forgotMutation.isPending ? "Sending..." : "Send Reset Link"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
