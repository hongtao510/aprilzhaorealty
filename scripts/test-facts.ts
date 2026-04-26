import { fetchPropertyFacts } from "../src/lib/redfin-property-facts";

const urls = [
  "https://www.redfin.com/CA/Belmont/1081-Judson-St-94002/home/744197",
  "https://www.redfin.com/CA/Redwood-City/323-Myrtle-St-94062/home/807570",
  "https://www.redfin.com/CA/San-Mateo/275-41st-Ave-94403/home/1903447",
];

(async () => {
  for (const url of urls) {
    const facts = await fetchPropertyFacts(url);
    console.log("\n" + url);
    console.log("  neighborhood:", facts?.neighborhood);
    console.log("  elem school rating:", facts?.elementary_school_rating);
    console.log("  reno tier:", facts?.renovation_tier, "keywords:", facts?.renovation_keywords);
    console.log("  desc head:", facts?.description?.slice(0, 200));
  }
})();
