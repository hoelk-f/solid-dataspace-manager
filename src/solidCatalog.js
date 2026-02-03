import {
  addUrl,
  createContainerAt,
  createSolidDataset,
  createThing,
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
const CENTRAL_REGISTRY_CONTAINER =
  "https://tmdt-solid-community-server.de/semanticdatacatalog/public/registry/";

export const getPodRoot = (webId) => {
  const url = new URL(webId);
  const segments = url.pathname.split("/").filter(Boolean);
  const profileIndex = segments.indexOf("profile");
  const baseSegments = profileIndex > -1 ? segments.slice(0, profileIndex) : segments;
  const basePath = baseSegments.length ? `/${baseSegments.join("/")}/` : "/";
  return `${url.origin}${basePath}`;
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

export const ensureCatalogStructure = async (webId, fetch, { title, description } = {}) => {
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
  await registerWebIdInCentralRegistry(webId, fetch);

  return { catalogDocUrl, catalogUrl };
};

const registerWebIdInCentralRegistry = async (webId, fetch) => {
  if (!webId) return;
  const containerUrl = CENTRAL_REGISTRY_CONTAINER;
  try {
    const containerDataset = await getSolidDataset(containerUrl, { fetch });
    const resources = getContainedResourceUrlAll(containerDataset);
    for (const resourceUrl of resources) {
      try {
        const memberDataset = await getSolidDataset(resourceUrl, { fetch });
        const memberThing =
          getThing(memberDataset, `${resourceUrl}#it`) || getThingAll(memberDataset)[0];
        const memberWebId = memberThing ? getUrl(memberThing, FOAF.member) : "";
        if (memberWebId === webId) return;
      } catch {
        // Ignore malformed entries.
      }
    }

    const turtle = [
      "@prefix foaf: <http://xmlns.com/foaf/0.1/>.",
      "@prefix dcterms: <http://purl.org/dc/terms/>.",
      "",
      "<#it> a foaf:Group ;",
      `  foaf:member <${webId}> ;`,
      `  dcterms:modified "${new Date().toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .`,
      "",
    ].join("\n");

    const res = await fetch(containerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/turtle",
        "Slug": `member-${encodeURIComponent(webId)}`,
      },
      body: turtle,
    });
    if (!res.ok) {
      throw new Error(
        `Failed to write central registry (${containerUrl}): ${res.status}`
      );
    }
  } catch (err) {
    throw new Error(
      `Failed to access central registry (${containerUrl}): ${err?.message || err}`
    );
  }
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

export const resetCatalog = async (webId, fetch, { title, description } = {}) => {
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

  return ensureCatalogStructure(webId, fetch, { title, description });
};
