// Reference metadata is separate from application logic and numeric CSV values.
// Review source: October 22, 2026 WakeScout QA Audit Report. These are not new observations.
export const temperatureProvenance={
 auditDate:'2026-10-22',
 unresolvedLakes:['Lake Powell','Huntington Reservoir','Millsite Reservoir'],
 basisLabels:{
  existing_baseline:'Existing seasonal baseline',
  third_party_modeled_seasonal_average:'Modeled seasonal average',
  estimated_observed_plus_climatology:'Proxy estimate from observations and climatological assumptions',
  usgs_modeled_historical_average:'Modeled historical average (secondary source)'
 },
 unresolvedDisclosure:'Independent verification incomplete. Existing values preserved; underlying monthly derivation has not been independently verified.',
 publishedDisclosure:'Published seasonal reference, not a current measured observation.'
};
