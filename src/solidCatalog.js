import {
  addUrl,
  createContainerAt,
  createSolidDataset,
  createThing,
  getSolidDataset,
  getSolidDatasetWithAcl,
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
} from "@inrupt/solid-client";
import { DCAT, DCTERMS, FOAF, RDF } from "@inrupt/vocab-common-rdf";

const CATALOG_CONTAINER = "dcat/";
const DATASET_CONTAINER = "dcat/ds/";
const SERIES_CONTAINER = "dcat/series/";
const RECORDS_CONTAINER = "dcat/records/";
const REGISTRY_DOC = "dcat/registry.ttl";
const CATALOG_DOC = "dcat/cat.ttl";
const SOLID = {
  publicTypeIndex: "http://www.w3.org/ns/solid/terms#publicTypeIndex",
  TypeIndex: "http://www.w3.org/ns/solid/terms#TypeIndex",
  TypeRegistration: "http://www.w3.org/ns/solid/terms#TypeRegistration",
  forClass: "http://www.w3.org/ns/solid/terms#forClass",
  instance: "http://www.w3.org/ns/solid/terms#instance",
};

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
    await getSolidDataset(containerUrl, { fetch });
  } catch (err) {
    if (err?.statusCode === 404 || err?.response?.status === 404) {
      await createContainerAt(containerUrl, { fetch });
    } else {
      throw err;
    }
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

const ensurePublicTypeIndex = async (webId, fetch) => {
  const profileDocUrl = webId.split("#")[0];
  const profileDataset = await getSolidDataset(profileDocUrl, { fetch });
  let profileThing = getThing(profileDataset, webId);
  if (!profileThing) {
    profileThing = createThing({ url: webId });
  }

  let publicTypeIndexUrl = getUrl(profileThing, SOLID.publicTypeIndex);
  if (!publicTypeIndexUrl) {
    const podRoot = getPodRoot(webId);
    const settingsContainer = `${podRoot}settings/`;
    await ensureContainer(settingsContainer, fetch);
    publicTypeIndexUrl = `${settingsContainer}publicTypeIndex.ttl`;
    const typeIndexDataset = createSolidDataset();
    let typeIndexThing = createThing({ url: `${publicTypeIndexUrl}#it` });
    typeIndexThing = addUrl(typeIndexThing, RDF.type, SOLID.TypeIndex);
    typeIndexThing = setStringNoLocale(typeIndexThing, DCTERMS.title, "Public Type Index");
    const withThing = setThing(typeIndexDataset, typeIndexThing);
    await saveSolidDatasetAt(publicTypeIndexUrl, withThing, { fetch });
    await makePublicReadable(publicTypeIndexUrl, fetch);

    profileThing = setUrl(profileThing, SOLID.publicTypeIndex, publicTypeIndexUrl);
    const updatedProfile = setThing(profileDataset, profileThing);
    await saveSolidDatasetAt(profileDocUrl, updatedProfile, { fetch });
  }

  return publicTypeIndexUrl;
};

const registerCatalogInTypeIndex = async (publicTypeIndexUrl, catalogUrl, fetch) => {
  const ptiDataset = await getSolidDataset(publicTypeIndexUrl, { fetch });
  const existing = getThingAll(ptiDataset).find((thing) => {
    const types = getUrlAll(thing, RDF.type);
    if (!types.includes(SOLID.TypeRegistration)) return false;
    const forClass = getUrl(thing, SOLID.forClass);
    return forClass === DCAT.Catalog;
  });

  let registration = existing || createThing({ url: `${publicTypeIndexUrl}#catalog` });
  registration = removeAll(registration, RDF.type);
  registration = addUrl(registration, RDF.type, SOLID.TypeRegistration);
  registration = removeAll(registration, SOLID.forClass);
  registration = setUrl(registration, SOLID.forClass, DCAT.Catalog);
  registration = removeAll(registration, SOLID.instance);
  registration = setUrl(registration, SOLID.instance, catalogUrl);

  const updated = setThing(ptiDataset, registration);
  await saveSolidDatasetAt(publicTypeIndexUrl, updated, { fetch });
};

export const getCatalogDocUrl = (webId) => `${getPodRoot(webId)}${CATALOG_DOC}`;
export const getCatalogUrl = (webId) => `${getCatalogDocUrl(webId)}#it`;
export const getRegistryDocUrl = (webId) => `${getPodRoot(webId)}${REGISTRY_DOC}`;

export const resolveCatalogUrl = async (webId, fetch) => {
  try {
    const profileDocUrl = webId.split("#")[0];
    const profileDoc = await getSolidDataset(profileDocUrl, { fetch });
    const profileThing = getThing(profileDoc, webId);
    const publicTypeIndexUrl = profileThing
      ? getUrl(profileThing, SOLID.publicTypeIndex)
      : null;
    if (publicTypeIndexUrl) {
      const ptiDataset = await getSolidDataset(publicTypeIndexUrl, { fetch });
      const registration = getThingAll(ptiDataset).find((thing) => {
        const types = getUrlAll(thing, RDF.type);
        const forClass = getUrl(thing, SOLID.forClass);
        return types.includes(SOLID.TypeRegistration) && forClass === DCAT.Catalog;
      });
      const instance = registration ? getUrl(registration, SOLID.instance) : null;
      if (instance) return instance;
    }
  } catch (err) {
    console.warn("Failed to resolve catalog URL from type index:", err);
  }

  return getCatalogUrl(webId);
};

export const ensureCatalogStructure = async (webId, fetch, { title, description } = {}) => {
  const podRoot = getPodRoot(webId);
  await ensureContainer(`${podRoot}${CATALOG_CONTAINER}`, fetch);
  await ensureContainer(`${podRoot}${DATASET_CONTAINER}`, fetch);
  await ensureContainer(`${podRoot}${SERIES_CONTAINER}`, fetch);
  await ensureContainer(`${podRoot}${RECORDS_CONTAINER}`, fetch);

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

  const registryDocUrl = getRegistryDocUrl(webId);
  let registryDataset;
  try {
    registryDataset = await getSolidDataset(registryDocUrl, { fetch });
  } catch (err) {
    if (err?.statusCode === 404 || err?.response?.status === 404) {
      registryDataset = createSolidDataset();
    } else {
      throw err;
    }
  }

  const registryUrl = `${registryDocUrl}#it`;
  let registryThing = getThing(registryDataset, registryUrl);
  if (!registryThing) {
    registryThing = createThing({ url: registryUrl });
  }
  registryThing = removeAll(registryThing, RDF.type);
  registryThing = addUrl(registryThing, RDF.type, FOAF.Group);
  registryThing = removeAll(registryThing, DCTERMS.title);
  registryThing = setStringNoLocale(registryThing, DCTERMS.title, "Dataspace Catalog Registry");
  registryThing = removeAll(registryThing, FOAF.member);
  registryThing = addUrl(registryThing, FOAF.member, webId);
  registryThing = removeAll(registryThing, DCTERMS.modified);
  registryThing = setDatetime(registryThing, DCTERMS.modified, new Date());

  registryDataset = setThing(registryDataset, registryThing);
  await saveSolidDatasetAt(registryDocUrl, registryDataset, { fetch });

  await makePublicReadable(catalogDocUrl, fetch);
  await makePublicReadable(registryDocUrl, fetch);
  await makePublicReadable(`${podRoot}${CATALOG_CONTAINER}`, fetch);

  const publicTypeIndexUrl = await ensurePublicTypeIndex(webId, fetch);
  await registerCatalogInTypeIndex(publicTypeIndexUrl, catalogUrl, fetch);

  return { catalogDocUrl, catalogUrl, registryDocUrl };
};

export const loadCatalogRegistryMembers = async (webId, fetch) => {
  const registryDocUrl = getRegistryDocUrl(webId);
  try {
    const registryDataset = await getSolidDataset(registryDocUrl, { fetch });
    const registryThing = getThing(registryDataset, `${registryDocUrl}#it`);
    const members = registryThing ? getUrlAll(registryThing, FOAF.member) : [];
    const unique = new Set([webId, ...members]);
    return Array.from(unique);
  } catch (err) {
    if (err?.statusCode !== 404 && err?.response?.status !== 404) {
      console.warn("Failed to load catalog registry:", err);
    }
    return [webId];
  }
};

export const saveCatalogRegistryMembers = async (webId, fetch, members) => {
  const podRoot = getPodRoot(webId);
  await ensureContainer(`${podRoot}${CATALOG_CONTAINER}`, fetch);
  const registryDocUrl = getRegistryDocUrl(webId);
  let registryDataset;
  try {
    registryDataset = await getSolidDataset(registryDocUrl, { fetch });
  } catch (err) {
    if (err?.statusCode === 404 || err?.response?.status === 404) {
      registryDataset = createSolidDataset();
    } else {
      throw err;
    }
  }

  const registryUrl = `${registryDocUrl}#it`;
  let registryThing = getThing(registryDataset, registryUrl);
  if (!registryThing) {
    registryThing = createThing({ url: registryUrl });
  }
  registryThing = removeAll(registryThing, RDF.type);
  registryThing = addUrl(registryThing, RDF.type, FOAF.Group);
  registryThing = removeAll(registryThing, DCTERMS.title);
  registryThing = setStringNoLocale(registryThing, DCTERMS.title, "Dataspace Catalog Registry");
  registryThing = removeAll(registryThing, FOAF.member);
  const unique = Array.from(new Set(members.filter(Boolean)));
  unique.forEach((member) => {
    registryThing = addUrl(registryThing, FOAF.member, member);
  });
  registryThing = removeAll(registryThing, DCTERMS.modified);
  registryThing = setDatetime(registryThing, DCTERMS.modified, new Date());

  registryDataset = setThing(registryDataset, registryThing);
  await saveSolidDatasetAt(registryDocUrl, registryDataset, { fetch });
  await makePublicReadable(registryDocUrl, fetch);
};
