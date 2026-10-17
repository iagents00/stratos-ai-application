import ClinicalDemoApp from "./ClinicalDemoApp";
// The live tenant is mounted by main.jsx through App and its normal auth guard.
// Every entry to this demo bundle stays synthetic, including mixed query URLs.
export default function DentalProfileRouter() {
  return <ClinicalDemoApp />;
}
