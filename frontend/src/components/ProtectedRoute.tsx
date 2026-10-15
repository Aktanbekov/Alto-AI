import React, { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getMe } from "../api";
import { setupTokenRefresh, stopTokenRefresh } from "../utils/tokenRefresh";
import { SIGNED_OUT_EVENT } from "../utils/tokenStorage";

type CurrentUser = {
    email: string;
    name?: string;
    picture?: string;
    college?: string;
    major?: string;
};

// The account this route verified, for pages that keep per-person state. It is
// always set inside a ProtectedRoute: children render only once it is known.
const CurrentUserContext = createContext<CurrentUser | null>(null);
export const useCurrentUser = () => useContext(CurrentUserContext);

type GateProps = { onAuthed: (user: CurrentUser | null) => void };

/*
 * Renders its children for a signed-in visitor.
 *
 * Signed out, it either shows `gate` in place - a page that explains why an
 * account is needed and offers one there - or, with no gate, sends the
 * visitor to /login and back here afterwards.
 */
export default function ProtectedRoute({
    children,
    gate: Gate,
}: {
    children: React.ReactNode;
    gate?: React.ComponentType<GateProps>;
}) {
    // undefined while checking, null when signed out.
    const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
    const location = useLocation();

    useEffect(() => {
        getMe().then((data) => {
            setUser(data || null);
            if (data) {
                setupTokenRefresh();
            }
        }).catch(() => {
            setUser(null);
            stopTokenRefresh();
        });

        // Signing out from the sidebar, or a session that expires, must take
        // the person off the page rather than leave it rendered behind them.
        const onSignedOut = () => setUser(null);
        addEventListener(SIGNED_OUT_EVENT, onSignedOut);

        return () => {
            stopTokenRefresh();
            removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
        };
    }, [])

    if (user === undefined) {
        // Usually a few hundred milliseconds. A quiet line rather than a
        // full-screen animation, so the page does not flash a second design.
        return (
            <p className="route-wait" role="status">Checking your sign-in…</p>
        );
    }
    if (!user) {
        if (Gate) {
            return (
                <Gate
                    onAuthed={(data) => {
                        if (!data) return;
                        setupTokenRefresh();
                        setUser(data);
                    }}
                />
            );
        }
        // Come back here after signing in, not to the home page.
        const back = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/login?redirect=${back}`} replace />;
    }
    return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}
