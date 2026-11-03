import type { NextConfig } from "next";

// Permit dev assets/HMR through this Codespace's port-3000 tunnel only.
// These are development resource origins, not API or extension permissions.
const codespace = process.env.CODESPACE_NAME;
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
const codespacesHost = codespace && /^[a-z0-9-]+$/.test(codespace)
  && forwardingDomain && /^[a-z0-9.-]+$/.test(forwardingDomain)
  ? `${codespace}-3000.${forwardingDomain}` : undefined;

const config: NextConfig = {
  transpilePackages: ["@navi-os/shared"],
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", ...(codespacesHost ? [codespacesHost] : [])],
};
export default config;
