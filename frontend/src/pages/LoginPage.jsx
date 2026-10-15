import AuthScreen from "../components/auth/AuthScreen";

// The shared sign-in form on its own page. See AuthScreen for why the page
// still exists alongside the header dialog.
export default function LoginPage() {
  return <AuthScreen mode="login" />;
}
