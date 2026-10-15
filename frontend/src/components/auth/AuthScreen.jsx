import { useNavigate, useSearchParams } from "react-router-dom";
import AuthForm from "./AuthForm";
import { useShell } from "../shell/shellContext";
import { safeRedirect } from "../../utils/authRedirect";

/*
 * /login and /signup: the shared form, set on the page inside the site shell
 * rather than on a separate screen in a separate style.
 *
 * Both pages still exist for the links that point at them - the legacy chat
 * flow, an expired session, a failed Google sign-in coming back with ?error=.
 */
export default function AuthScreen({ mode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setUser } = useShell();
  const redirect = safeRedirect(params.get("redirect"));
  const oauthError = params.get("error");

  return (
    <div className="tf">
      <div className="page-w auth-page">
        <div className="auth-page-in">
          {oauthError && (
            <p className="auth-error" role="alert">
              {decodeURIComponent(oauthError)}
            </p>
          )}
          <div className="auth-panel">
            <AuthForm
              mode={mode}
              redirect={redirect}
              idPrefix="page"
              onAuthed={(user) => {
                setUser(user);
                navigate(redirect);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
