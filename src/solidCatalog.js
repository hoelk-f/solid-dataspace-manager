import {
  addUrl,
  createContainerAt,
  createSolidDataset,
  createThing,
  getStringNoLocale,
  getSolidDataset,
  getSolidDatasetWithAcl,
  getContainedResourceUrlAll,
  getThing,
  getThingAll,
  getUrl,
  getUrlAll,
  hasAccessibleAcl,
  hasResourceAcl,
  removeAll,
  saveAclFor,
  saveSolidDatasetAt,
  setDatetime,
  setPublicResourceAccess,
  setStringNoLocale,
  setThing,
  setUrl,
  createAclFromFallbackAcl,
  getResourceAcl,
  deleteFile,
} from "@inrupt/solid-client";
import { DCAT, DCTERMS, FOAF, RDF } from "@inrupt/vocab-common-rdf";

const CATALOG_CONTAINER = "catalog/";
const DATASET_CONTAINER = "catalog/ds/";
const SERIES_CONTAINER = "catalog/series/";
const RECORDS_CONTAINER = "catalog/records/";
const CATALOG_DOC = "catalog/cat.ttl";
const SDM_NS = "https://w3id.org/solid-dataspace-manager#";
const SDM_REGISTRY_MODE = `${SDM_NS}registryMode`;
const SDM_REGISTRY = `${SDM_NS}registry`;
const SDM_PRIVATE_REGISTRY = `${SDM_NS}privateRegistry`;

export const DEFAULT_RESEARCH_REGISTRY_URL =
  "https://tmdt-solid-community-server.de/semanticdatacatalog/public/stadt-wuppertal";
export const DEFAULT_RESEARCH_REGISTRIES = [DEFAULT_RESEARCH_REGISTRY_URL];

export const REGISTRY_PRESETS = [
  {
    id: "stadt-wuppertal",
    label: "Gesundes Tal",
    url: DEFAULT_RESEARCH_REGISTRY_URL,
  },
  {
    id: "dace",
    label: "DACE",
    url: "https://tmdt-solid-community-server.de/semanticdatacatalog/public/dace",
  },
  {
    id: "timberconnect",
    label: "TimberConnect",
    url: "https://tmdt-solid-community-server.de/semanticdatacatalog/public/timberconnect",
  },
];

export const getPodRoot = (webId) => {
  const url = new URL(webId);
  const segments = url.pathname.split("/").filter(Boolean);
  const profileIndex = segments.indexOf("profile");
  const baseSegments = profileIndex > -1 ? segments.slice(0, profileIndex) : segments;
  const basePath = baseSegments.length ? `/${baseSegments.join("/")}/` : "/";
  return `${url.origin}${basePath}`;
};

export const buildDefaultPrivateRegistry = (webId) => {
  if (!webId) return "";
  return `${getPodRoot(webId)}registry/`;
};

const normalizeContainerUrl = (value) => {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.href.endsWith("/") ? url.href : `${url.href}/`;
  } catch {
    return value.endsWith("/") ? value : `${value}/`;
  }
};

const ensureContainer = async (containerUrl, fetch) => {
  try {
    const res = await fetch(containerUrl, {
      method: "GET",
      headers: { Accept: "text/turtle" },
    });
    if (res.ok) return;
    if (res.status !== 404) return;
  } catch {
    // Continue and attempt creation.
  }

  try {
    await createContainerAt(containerUrl, { fetch });
  } catch (err) {
    const status = err?.statusCode || err?.response?.status;
    if (status === 409 || status === 412) {
      return;
    }
    throw err;
  }
};

const getResourceAndAcl = async (url, fetch) => {
  const resource = await getSolidDatasetWithAcl(url, { fetch });
  let resourceAcl;
  if (!hasResourceAcl(resource)) {
    if (!hasAccessibleAcl(resource)) {
      throw new Error("No access to ACL.");
    }
    resourceAcl = createAclFromFallbackAcl(resource);
  } else {
    resourceAcl = getResourceAcl(resource);
  }
  return { resource, resourceAcl };
};

const makePublicReadable = async (url, fetch) => {
  try {
    const { resource, resourceAcl } = await getResourceAndAcl(url, fetch);
    const updatedAcl = setPublicResourceAccess(resourceAcl, {
      read: true,
      append: false,
      write: false,
      control: false,
    });
    await saveAclFor(resource, updatedAcl, { fetch });
  } catch (err) {
    console.warn("Failed to set public read ACL for", url, err);
  }
};

const setCatalogLinkInProfile = async (webId, catalogUrl, fetch) => {
  if (!webId || !catalogUrl) return;
  const profileDocUrl = webId.split("#")[0];
  const profileDataset = await getSolidDataset(profileDocUrl, { fetch });
  let profileThing = getThing(profileDataset, webId);
  if (!profileThing) {
    profileThing = createThing({ url: webId });
  }
  profileThing = removeAll(profileThing, DCAT.catalog);
  profileThing = setUrl(profileThing, DCAT.catalog, catalogUrl);
  const updatedProfile = setThing(profileDataset, profileThing);
  await saveSolidDatasetAt(profileDocUrl, updatedProfile, { fetch });
};

export const loadRegistryConfig = async (webId, fetch) => {
  if (!webId || !fetch) {
    return { mode: "research", registries: [], privateRegistry: "" };
  }
  const profileDocUrl = webId.split("#")[0];
  try {
    const profileDataset = await getSolidDataset(profileDocUrl, { fetch });
    const profileThing = getThing(profileDataset, webId);
    const mode = (getStringNoLocale(profileThing, SDM_REGISTRY_MODE) || "research").toLowerCase();
    const registries = (getUrlAll(profileThing, SDM_REGISTRY) || [])
      .filter(Boolean)
      .map((url) => url.replace(/\/+$/, ""));
    const privateRegistry =
      getUrl(profileThing, SDM_PRIVATE_REGISTRY) || buildDefaultPrivateRegistry(webId);
    return {
      mode: mode === "private" ? "private" : "research",
      registries,
      privateRegistry,
    };
  } catch (err) {
    console.warn("Failed to load registry config from profile:", err);
    return {
      mode: "research",
      registries: [],
      privateRegistry: buildDefaultPrivateRegistry(webId),
    };
  }
};

export const saveRegistryConfig = async (webId, fetch, config) => {
  if (!webId || !fetch) return;
  const profileDocUrl = webId.split("#")[0];
  const profileDataset = await getSolidDataset(profileDocUrl, { fetch });
  let profileThing = getThing(profileDataset, webId);
  if (!profileThing) {
    profileThing = createThing({ url: webId });
  }

  const mode = config?.mode === "private" ? "private" : "research";
  const registries = (config?.registries || [])
    .filter(Boolean)
    .map((url) => url.replace(/\/+$/, ""));
  const privateRegistry = config?.privateRegistry || buildDefaultPrivateRegistry(webId);

  profileThing = removeAll(profileThing, SDM_REGISTRY_MODE);
  profileThing = setStringNoLocale(profileThing, SDM_REGISTRY_MODE, mode);
  profileThing = removeAll(profileThing, SDM_REGISTRY);
  registries.forEach((url) => {
    profileThing = addUrl(profileThing, SDM_REGISTRY, url);
  });
  profileThing = removeAll(profileThing, SDM_PRIVATE_REGISTRY);
  if (privateRegistry) {
    profileThing = setUrl(profileThing, SDM_PRIVATE_REGISTRY, privateRegistry);
  }

  const updatedProfile = setThing(profileDataset, profileThing);
  await saveSolidDatasetAt(profileDocUrl, updatedProfile, { fetch });
};

const ensureRegistryContainer = async (containerUrl, fetch) => {
  await ensureContainer(containerUrl, fetch);
  await makePublicReadable(containerUrl, fetch);
};

export const ensurePrivateRegistryContainer = async (
  webId,
  fetch,
  privateRegistryUrl
) => {
  if (!webId || !fetch) return "";
  const target =
    normalizeContainerUrl(privateRegistryUrl || buildDefaultPrivateRegistry(webId));
  if (!target) return "";
  await ensureRegistryContainer(target, fetch);
  return target;
};

const resolveRegistryConfig = async (webId, fetch, override) => {
  const base = override || (await loadRegistryConfig(webId, fetch));
  const mode = base?.mode === "private" ? "private" : "research";
  const registries = (base?.registries || []).filter(Boolean);
  const privateRegistry =
    base?.privateRegistry || buildDefaultPrivateRegistry(webId);
  return { mode, registries, privateRegistry };
};

const registerWebIdInRegistryContainer = async (
  containerUrl,
  fetch,
  memberWebId,
  { allowCreate } = {}
) => {
  const normalizedUrl = normalizeContainerUrl(containerUrl);
  if (!normalizedUrl || !memberWebId) return;

  if (allowCreate) {
    await ensureRegistryContainer(normalizedUrl, fetch);
  }

  const containerDataset = await getSolidDataset(normalizedUrl, { fetch });
  const resources = getContainedResourceUrlAll(containerDataset);
  for (const resourceUrl of resources) {
    try {
      const memberDataset = await getSolidDataset(resourceUrl, { fetch });
      const memberThing =
        getThing(memberDataset, `${resourceUrl}#it`) || getThingAll(memberDataset)[0];
        const existingWebId = memberThing ? getUrl(memberThing, FOAF.member) : "";
        if (existingWebId === memberWebId) return;
    } catch {
      // Ignore malformed entries.
    }
  }

  const turtle = [
    "@prefix foaf: <http://xmlns.com/foaf/0.1/>.",
    "@prefix dcterms: <http://purl.org/dc/terms/>.",
    "",
    "<#it> a foaf:Group ;",
    `  foaf:member <${memberWebId}> ;`,
    `  dcterms:modified "${new Date().toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .`,
    "",
  ].join("\n");

  const res = await fetch(normalizedUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/turtle",
      "Slug": `member-${encodeURIComponent(memberWebId)}`,
    },
    body: turtle,
  });
  if (!res.ok) {
    throw new Error(`Failed to write registry (${normalizedUrl}): ${res.status}`);
  }
};

const registerWebIdInRegistries = async (webId, fetch, registryConfig) => {
  if (!webId) return;
  const config = await resolveRegistryConfig(webId, fetch, registryConfig);
  let containers = [];
  let allowCreate = false;

  if (config.mode === "private") {
    allowCreate = true;
    containers = [config.privateRegistry];
  } else {
    containers = config.registries;
  }

  const normalized = Array.from(
    new Set(containers.map(normalizeContainerUrl).filter(Boolean))
  );
  if (!normalized.length) return;

  for (const containerUrl of normalized) {
    try {
      await registerWebIdInRegistryContainer(containerUrl, fetch, webId, { allowCreate });
    } catch (err) {
      throw new Error(
        `Failed to access registry (${containerUrl}): ${err?.message || err}`
      );
    }
  }
};

const removeWebIdFromRegistryContainer = async (containerUrl, fetch, webId) => {
  const normalizedUrl = normalizeContainerUrl(containerUrl);
  if (!normalizedUrl) return;
  try {
    const containerDataset = await getSolidDataset(normalizedUrl, { fetch });
    const resources = getContainedResourceUrlAll(containerDataset);
    for (const resourceUrl of resources) {
      try {
        const memberDataset = await getSolidDataset(resourceUrl, { fetch });
        const memberThing =
          getThing(memberDataset, `${resourceUrl}#it`) || getThingAll(memberDataset)[0];
        const memberWebId = memberThing ? getUrl(memberThing, FOAF.member) : "";
        if (memberWebId === webId) {
          await deleteFile(resourceUrl, { fetch });
        }
      } catch {
        // Ignore malformed entries.
      }
    }
  } catch (err) {
    const status = err?.statusCode || err?.response?.status;
    if (status === 404) return;
    console.warn("Failed to remove member from registry", normalizedUrl, err);
  }
};

export const syncRegistryMembership = async (
  webId,
  fetch,
  previousConfig,
  nextConfig
) => {
  if (!webId || !fetch) return;
  const prev = await resolveRegistryConfig(webId, fetch, previousConfig);
  const next = await resolveRegistryConfig(webId, fetch, nextConfig);

  const prevContainers = new Set(
    (prev.mode === "private" ? [prev.privateRegistry] : prev.registries)
      .map(normalizeContainerUrl)
      .filter(Boolean)
  );
  const nextContainers = new Set(
    (next.mode === "private" ? [next.privateRegistry] : next.registries)
      .map(normalizeContainerUrl)
      .filter(Boolean)
  );

  for (const containerUrl of prevContainers) {
    if (!nextContainers.has(containerUrl)) {
      await removeWebIdFromRegistryContainer(containerUrl, fetch, webId);
    }
  }

  const allowCreate = next.mode === "private";
  for (const containerUrl of nextContainers) {
    await registerWebIdInRegistryContainer(containerUrl, fetch, webId, { allowCreate });
  }
};

export const loadRegistryMembersFromContainer = async (containerUrl, fetch) => {
  const normalizedUrl = normalizeContainerUrl(containerUrl);
  if (!normalizedUrl || !fetch) return [];
  try {
    const containerDataset = await getSolidDataset(normalizedUrl, { fetch });
    const resourceUrls = getContainedResourceUrlAll(containerDataset);
    const members = new Set();
    for (const resourceUrl of resourceUrls) {
      try {
        const memberDataset = await getSolidDataset(resourceUrl, { fetch });
        const memberThing =
          getThing(memberDataset, `${resourceUrl}#it`) || getThingAll(memberDataset)[0];
        const memberWebId = memberThing ? getUrl(memberThing, FOAF.member) : "";
        if (memberWebId) members.add(memberWebId);
      } catch {
        // Ignore malformed entries.
      }
    }
    return Array.from(members);
  } catch (err) {
    const status = err?.statusCode || err?.response?.status;
    if (status === 404) return [];
    console.warn("Failed to load registry container", normalizedUrl, err);
    return [];
  }
};

export const syncRegistryMembersInContainer = async (
  containerUrl,
  fetch,
  members,
  { allowCreate } = {}
) => {
  const normalizedUrl = normalizeContainerUrl(containerUrl);
  if (!normalizedUrl || !fetch) return;
  const cleanedMembers = Array.from(
    new Set((members || []).map((m) => (m || "").trim()).filter(Boolean))
  );

  if (allowCreate) {
    await ensureRegistryContainer(normalizedUrl, fetch);
  }

  const containerDataset = await getSolidDataset(normalizedUrl, { fetch });
  const resourceUrls = getContainedResourceUrlAll(containerDataset);
  const existing = new Map();
  for (const resourceUrl of resourceUrls) {
    try {
      const memberDataset = await getSolidDataset(resourceUrl, { fetch });
      const memberThing =
        getThing(memberDataset, `${resourceUrl}#it`) || getThingAll(memberDataset)[0];
      const memberWebId = memberThing ? getUrl(memberThing, FOAF.member) : "";
      if (memberWebId) {
        existing.set(memberWebId, resourceUrl);
      }
    } catch {
      // Ignore malformed entries.
    }
  }

  for (const [memberWebId, resourceUrl] of existing.entries()) {
    if (!cleanedMembers.includes(memberWebId)) {
      await deleteFile(resourceUrl, { fetch });
      existing.delete(memberWebId);
    }
  }

  for (const memberWebId of cleanedMembers) {
    if (!existing.has(memberWebId)) {
      await registerWebIdInRegistryContainer(normalizedUrl, fetch, memberWebId, { allowCreate });
    }
  }
};

export const getCatalogDocUrl = (webId) => `${getPodRoot(webId)}${CATALOG_DOC}`;
export const getCatalogUrl = (webId) => `${getCatalogDocUrl(webId)}#it`;
export const resolveCatalogUrl = async (webId, fetch) => {
  try {
    const profileDocUrl = webId.split("#")[0];
    const profileDoc = await getSolidDataset(profileDocUrl, { fetch });
    const profileThing = getThing(profileDoc, webId);
    const profileCatalog = profileThing ? getUrl(profileThing, DCAT.catalog) : null;
    if (profileCatalog) return profileCatalog;
  } catch (err) {
    console.warn("Failed to resolve catalog URL from profile:", err);
  }

  return getCatalogUrl(webId);
};

export const ensureCatalogStructure = async (
  webId,
  fetch,
  { title, description, registryConfig } = {}
) => {
  const podRoot = getPodRoot(webId);
  await ensureContainer(`${podRoot}${CATALOG_CONTAINER}`, fetch);
  await ensureContainer(`${podRoot}${DATASET_CONTAINER}`, fetch);
  await ensureContainer(`${podRoot}${SERIES_CONTAINER}`, fetch);
  await ensureContainer(`${podRoot}${RECORDS_CONTAINER}`, fetch);

  const legacyRegistryUrl = `${podRoot}catalog/registry.ttl`;
  try {
    await deleteFile(legacyRegistryUrl, { fetch });
  } catch {
    // Ignore missing legacy registry.
  }

  const catalogDocUrl = getCatalogDocUrl(webId);
  const catalogUrl = `${catalogDocUrl}#it`;

  let catalogDataset;
  try {
    catalogDataset = await getSolidDataset(catalogDocUrl, { fetch });
  } catch (err) {
    if (err?.statusCode === 404 || err?.response?.status === 404) {
      catalogDataset = createSolidDataset();
    } else {
      throw err;
    }
  }

  let catalogThing = getThing(catalogDataset, catalogUrl);
  if (!catalogThing) {
    catalogThing = createThing({ url: catalogUrl });
  }
  catalogThing = removeAll(catalogThing, RDF.type);
  catalogThing = addUrl(catalogThing, RDF.type, DCAT.Catalog);
  catalogThing = removeAll(catalogThing, DCTERMS.title);
  catalogThing = setStringNoLocale(
    catalogThing,
    DCTERMS.title,
    title || "Solid Dataspace Catalog"
  );
  catalogThing = removeAll(catalogThing, DCTERMS.description);
  if (description) {
    catalogThing = setStringNoLocale(catalogThing, DCTERMS.description, description);
  }
  catalogThing = removeAll(catalogThing, DCTERMS.modified);
  catalogThing = setDatetime(catalogThing, DCTERMS.modified, new Date());

  catalogDataset = setThing(catalogDataset, catalogThing);
  await saveSolidDatasetAt(catalogDocUrl, catalogDataset, { fetch });

  await makePublicReadable(catalogDocUrl, fetch);
  await makePublicReadable(`${podRoot}${CATALOG_CONTAINER}`, fetch);

  await setCatalogLinkInProfile(webId, catalogUrl, fetch);
  await registerWebIdInRegistries(webId, fetch, registryConfig);

  return { catalogDocUrl, catalogUrl };
};

const deleteContainerContents = async (containerUrl, fetch) => {
  const dataset = await getSolidDataset(containerUrl, { fetch });
  const resources = getContainedResourceUrlAll(dataset);
  for (const resourceUrl of resources) {
    if (resourceUrl.endsWith("/")) {
      await deleteContainerContents(resourceUrl, fetch);
      try {
        await deleteFile(resourceUrl, { fetch });
      } catch (err) {
        console.warn("Failed to delete container", resourceUrl, err);
      }
    } else {
      try {
        await deleteFile(resourceUrl, { fetch });
      } catch (err) {
        console.warn("Failed to delete resource", resourceUrl, err);
      }
    }
  }
};

export const resetCatalog = async (
  webId,
  fetch,
  { title, description, registryConfig } = {}
) => {
  const podRoot = getPodRoot(webId);
  const catalogContainerUrl = `${podRoot}${CATALOG_CONTAINER}`;
  try {
    await deleteContainerContents(catalogContainerUrl, fetch);
    await deleteFile(catalogContainerUrl, { fetch });
  } catch (err) {
    const status = err?.statusCode || err?.response?.status;
    if (status !== 404) {
      console.warn("Failed to delete catalog container", err);
    }
  }

  return ensureCatalogStructure(webId, fetch, { title, description, registryConfig });
};
