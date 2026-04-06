const fallbackConfig = {
  apps: [
    {
      id: "smart-city-urban-heat-monitoring",
      title: "Urban Heat Monitoring",
      href: "/web/smart-city-urban-heat-monitoring",
      section: "applications",
      iconKey: "temperature",
      visible: true,
      order: 10,
      linkType: "internal",
    },
    {
      id: "solid-health-app",
      title: "Solid Health App",
      href: "/web/solid-health-app",
      section: "applications",
      iconKey: "health",
      visible: true,
      order: 20,
      linkType: "internal",
    },
  ],
  providers: [
    {
      id: "tmdt-solid",
      label: "TMDT Solid",
      issuer: "https://tmdt-solid-community-server.de",
      note: "Recommended",
      enabled: true,
      recommended: true,
    },
    {
      id: "solid-community",
      label: "Solid Community",
      issuer: "https://solidcommunity.net",
      note: "Public community server",
      enabled: true,
      recommended: false,
    },
  ],
  branding: {
    projectName: "Solid Dataspace",
    logoUrl: "/Logo_TMDT.png",
    logoAlt: "Project Logo",
  },
};

function getWindowConfig() {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__APP_CONFIG__ || {};
}

function normalizeApp(app, index) {
  return {
    id: app?.id || `app-${index}`,
    title: app?.title || `App ${index + 1}`,
    href: app?.href || "/",
    section: app?.section || "applications",
    iconKey: app?.iconKey || "default",
    visible: app?.visible !== false,
    order: typeof app?.order === "number" ? app.order : index * 10,
    linkType: app?.linkType === "internal" ? "internal" : "external",
  };
}

function normalizeProvider(provider, index) {
  return {
    id: provider?.id || `provider-${index}`,
    label: provider?.label || `Provider ${index + 1}`,
    issuer: provider?.issuer || provider?.url || "",
    note: provider?.note || "",
    enabled: provider?.enabled !== false,
    recommended: Boolean(provider?.recommended),
  };
}

function normalizeBranding(branding) {
  return {
    projectName: branding?.projectName || "Solid Dataspace",
    logoUrl: branding?.logoUrl || "/Logo_TMDT.png",
    logoAlt: branding?.logoAlt || branding?.projectName || "Project Logo",
  };
}

const runtimeConfig = getWindowConfig();

const appsSource =
  Array.isArray(runtimeConfig.apps) && runtimeConfig.apps.length > 0
    ? runtimeConfig.apps
    : fallbackConfig.apps;

const providersSource =
  Array.isArray(runtimeConfig.providers) && runtimeConfig.providers.length > 0
    ? runtimeConfig.providers
    : fallbackConfig.providers;

const brandingSource =
  runtimeConfig.branding && Object.keys(runtimeConfig.branding).length > 0
    ? runtimeConfig.branding
    : fallbackConfig.branding;

export const appConfig = {
  apps: appsSource.map(normalizeApp),
  providers: providersSource.map(normalizeProvider),
  branding: normalizeBranding(brandingSource),
};

export function getAppsBySection(section) {
  return appConfig.apps
    .filter((app) => app.visible && app.section === section)
    .sort((a, b) => a.order - b.order);
}

export function getEnabledProviders() {
  return appConfig.providers.filter(
    (provider) => provider.enabled && provider.issuer
  );
}

export function getRecommendedProvider() {
  const providers = getEnabledProviders();
  return providers.find((provider) => provider.recommended) || providers[0] || null;
}

export function getBranding() {
  return appConfig.branding;
}