import type { ReactElement } from "react";
import { Redirect } from "wouter";

import { AuthSkeleton } from "../../../layout/auth-skeleton/auth-skeleton";
import { HOME_PATH } from "../../../routes";
import { LoginScreen } from "../../login/login-screen";
import { useSession } from "../api/use-session";

/** The sign-in: someone who is already signed in goes to the home page instead. */
export function LoginRoute(): ReactElement {
  const session = useSession();
  if (session.status === "loading") {
    return <AuthSkeleton />;
  }
  if (session.status === "authenticated") {
    return <Redirect to={HOME_PATH} replace />;
  }
  return <LoginScreen />;
}
