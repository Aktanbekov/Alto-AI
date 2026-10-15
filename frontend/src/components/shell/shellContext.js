import { createContext, useContext } from "react";

// What a page inside the shell can reach: who is signed in, and the sign-in
// dialog. The account gate on the profile check signs people in inline and has
// to tell the header about it, or the header keeps offering "Log in".
export const ShellContext = createContext({ user: null, setUser: () => {}, openAuth: () => {} });
export const useShell = () => useContext(ShellContext);
