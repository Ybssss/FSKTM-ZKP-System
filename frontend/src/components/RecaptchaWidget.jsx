import React, { useEffect, useRef } from "react";

const SCRIPT_ID = "google-recaptcha-script";
const SCRIPT_SRC = "https://www.google.com/recaptcha/api.js?render=explicit";

export default function RecaptchaWidget({
  siteKey,
  onTokenChange,
  resetNonce = 0,
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const lastResetNonceRef = useRef(resetNonce);

  useEffect(() => {
    if (!siteKey) {
      return undefined;
    }

    let disposed = false;

    const renderWidget = () => {
      const { grecaptcha } = window;
      if (
        disposed ||
        !grecaptcha ||
        !containerRef.current ||
        widgetIdRef.current !== null
      ) {
        return;
      }

      widgetIdRef.current = grecaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onTokenChange(token),
        "expired-callback": () => onTokenChange(""),
        "error-callback": () => onTokenChange(""),
      });
    };

    // Reuse the global Google script so the widget can be mounted from repeated visits to the login page.
    const handleScriptReady = () => {
      const { grecaptcha } = window;
      if (!grecaptcha) {
        return;
      }

      if (typeof grecaptcha.ready === "function") {
        grecaptcha.ready(renderWidget);
        return;
      }

      renderWidget();
    };

    if (window.grecaptcha) {
      handleScriptReady();
      return () => {
        disposed = true;
      };
    }

    let script = document.getElementById(SCRIPT_ID);
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    script.addEventListener("load", handleScriptReady);

    return () => {
      disposed = true;
      script.removeEventListener("load", handleScriptReady);
    };
  }, [onTokenChange, siteKey]);

  useEffect(() => {
    if (lastResetNonceRef.current === resetNonce) {
      return;
    }

    lastResetNonceRef.current = resetNonce;

    // Reset the widget after each challenge attempt so the next request uses a fresh token.
    if (widgetIdRef.current === null || !window.grecaptcha) {
      onTokenChange("");
      return;
    }

    window.grecaptcha.reset(widgetIdRef.current);
    onTokenChange("");
  }, [onTokenChange, resetNonce]);

  return <div ref={containerRef} className="min-h-[78px]" />;
}
