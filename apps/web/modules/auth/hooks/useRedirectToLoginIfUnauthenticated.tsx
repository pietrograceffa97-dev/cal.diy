"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRedirectToLoginIfUnauthenticated(isPublic = false) {
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const router = useRouter();
  useEffect(() => {
    if (isPublic) {
      return;
    }

    if (!loading && !session) {
      // Use location.origin + location.pathname: location.pathname
      // already contains the basePath when the browser is at a
      // basePath-prefixed URL. The prior code used WEBAPP_URL which
      // also includes the basePath, yielding a doubled prefix in the
      // callbackUrl whenever the app is mounted at a non-empty
      // basePath behind an external prefix.
      const urlSearchParams = new URLSearchParams();
      urlSearchParams.set("callbackUrl", `${location.origin}${location.pathname}${location.search}`);
      router.replace(`/auth/login?${urlSearchParams.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, isPublic]);

  return {
    loading: loading && !session,
    session,
  };
}
