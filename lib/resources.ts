/**
 * Official, free resources for workers, shown on /resources. Every URL was
 * checked live when added (October 2026). Titles and descriptions live in the
 * message dictionaries under `resources.items.<id>`.
 */

export type ResourceCountry = "CA" | "US";
export type ResourceCategory = "taxes" | "pay" | "benefits" | "safety";

export interface ResourceLink {
  id: ResourceId;
  country: ResourceCountry;
  category: ResourceCategory;
  url: string;
}

export const RESOURCE_LINKS = [
  { id: "craAccount", country: "CA", category: "taxes", url: "https://www.canada.ca/en/revenue-agency/services/e-services/cra-login-services.html" },
  { id: "caTaxClinics", country: "CA", category: "taxes", url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/community-volunteer-income-tax-program.html" },
  { id: "caMinimumWage", country: "CA", category: "pay", url: "https://minwage-salairemin.service.canada.ca/en/general.html" },
  { id: "caWorkplaceStandards", country: "CA", category: "pay", url: "https://www.canada.ca/en/services/jobs/workplace.html" },
  { id: "caEmploymentInsurance", country: "CA", category: "benefits", url: "https://www.canada.ca/en/services/benefits/ei.html" },
  { id: "caSafety", country: "CA", category: "safety", url: "https://www.ccohs.ca/" },
  { id: "irsFreeFile", country: "US", category: "taxes", url: "https://www.irs.gov/file-your-taxes-for-free" },
  { id: "irsVita", country: "US", category: "taxes", url: "https://www.irs.gov/individuals/free-tax-return-preparation-for-qualifying-taxpayers" },
  { id: "irsWithholding", country: "US", category: "taxes", url: "https://www.irs.gov/individuals/tax-withholding-estimator" },
  { id: "usMinimumWage", country: "US", category: "pay", url: "https://www.dol.gov/agencies/whd/minimum-wage/state" },
  { id: "usWageHelp", country: "US", category: "pay", url: "https://www.dol.gov/agencies/whd/contact" },
  { id: "usUnemployment", country: "US", category: "benefits", url: "https://www.careeronestop.org/LocalHelp/UnemploymentBenefits/find-unemployment-benefits.aspx" },
  { id: "usSafety", country: "US", category: "safety", url: "https://www.osha.gov/workers" },
] as const satisfies readonly { id: string; country: ResourceCountry; category: ResourceCategory; url: string }[];

export type ResourceId = (typeof RESOURCE_LINKS)[number]["id"];

export const RESOURCE_CATEGORIES: ResourceCategory[] = ["taxes", "pay", "benefits", "safety"];
