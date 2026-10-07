import landingPage from "../../demo/landing-page.json";
import pricing from "../../demo/pricing.json";
import { GeneratedComponentsSchema, type GeneratedComponent } from "./schema";

// DEMO_MODE outputs live in /demo/*.json. They are statically imported (not read with fs) so they are
// always bundled, and they pass through the same schema as live model output so they cannot drift.
const DEMOS: { match: RegExp; data: unknown }[] = [
  { match: /pric/i, data: pricing },
  { match: /./, data: landingPage },
];

export function loadDemo(targetType: string): GeneratedComponent[] {
  const demo = DEMOS.find((d) => d.match.test(targetType)) ?? DEMOS[DEMOS.length - 1];
  return GeneratedComponentsSchema.parse(demo.data);
}
