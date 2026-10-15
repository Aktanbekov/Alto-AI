import AuthScreen from "../components/auth/AuthScreen";

// The shared account form, opened on "Create account". See AuthScreen.
export default function SignupPage() {
  return <AuthScreen mode="signup" />;
}
