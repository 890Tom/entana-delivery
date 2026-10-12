import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { Route, Switch, useLocation } from "wouter";

import { createQueryClient } from "./data-fetching/query-client";
import { LoginRoute } from "./features/session/guard/login-route";
import { ProtectedArea } from "./features/session/guard/protected-area";
import { SESSION_NOTICE_CONTEXT } from "./features/session/session-notice";
import { useDocumentTitle } from "./layout/document-title";
import { LOGIN_PATH } from "./routes";

function Routes(): ReactElement {
  useDocumentTitle();
  return (
    <Switch>
      <Route path={LOGIN_PATH} component={LoginRoute} />
      <Route component={ProtectedArea} />
    </Switch>
  );
}

/**
 * The application. The "session ended" message lives here, in memory only: it is neither in the
 * address nor in any storage, so a reload of the sign-in does not repeat it.
 */
export function App(): ReactElement {
  const [, navigate] = useLocation();
  const [isExpired, setIsExpired] = useState(false);
  const [client] = useState(() =>
    createQueryClient(() => {
      setIsExpired(true);
      navigate(LOGIN_PATH, { replace: true });
    }),
  );
  const notice = useMemo(
    () => ({
      isExpired,
      dismiss: () => {
        setIsExpired(false);
      },
    }),
    [isExpired],
  );
  return (
    <QueryClientProvider client={client}>
      <SESSION_NOTICE_CONTEXT value={notice}>
        <Routes />
      </SESSION_NOTICE_CONTEXT>
    </QueryClientProvider>
  );
}
