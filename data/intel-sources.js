// Official API traced from the iframe linked on Utah DEQ's recreation page.
// Extend by state with a separately verified adapter; do not fuzzy-match lake names.
export const intelSource = Object.freeze({
 id:'ut-deq', state:'UT', name:'Utah DEQ · Division of Water Quality',
 endpoint:'https://services2.arcgis.com/NnxP4LZ3zX8wWmP9/arcgis/rest/services/AutoMap_Source_Data/FeatureServer/0/query',
 url:'https://deq.utah.gov/dwq/recreational-water-quality',
 rampURL:'https://stateparks.utah.gov/boat-ramp-conditions/',
 cacheMs:15*60*1000, timeoutMs:8000, maxAgeDays:45, candidateLimit:20,
 // 45 days is WakeScout's conservative freshness policy, not an agency expiry.
});
export const intelLakeAliases = Object.freeze({
 'bear-lake':['Bear Lake'], 'deer-creek':['Deer Creek Reservoir'],
 'east-canyon':['East Canyon Reservoir'], echo:['Echo Reservoir'],
 'flaming-gorge':['Flaming Gorge Reservoir'], gunlock:['Gunlock Reservoir'],
 huntington:['Huntington Reservoir'], hyrum:['Hyrum Reservoir'],
 jordanelle:['Jordanelle Reservoir'], 'lake-powell':['Lake Powell'],
 millsite:['Millsite Reservoir'], 'otter-creek':['Otter Creek Reservoir'],
 pineview:['Pineview Reservoir'], piute:['Piute Reservoir'],
 'quail-creek':['Quail Creek Reservoir'], 'red-fleet':['Red Fleet Reservoir'],
 rockport:['Rockport Reservoir'], 'sand-hollow':['Sand Hollow Reservoir'],
 scofield:['Scofield Reservoir'], starvation:['Starvation Reservoir'],
 steinaker:['Steinaker Reservoir'], strawberry:['Strawberry Reservoir'],
 'utah-lake':['Utah Lake'], 'willard-bay':['Willard Bay'], yuba:['Yuba Lake'],
});
