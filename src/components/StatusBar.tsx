import { InfoIcon } from "./Icons";

export function StatusBar() {
  return (
    <footer className="command-footer">
      <div className="footer-meta-row">
        <div className="footer-left">
          <span className="footer-pill">
            <span className="pill-dot" />
            OPERATIONAL BOUNDS: VIJAYAWADA (NTR DISTRICT, AP)
          </span>
          <span className="footer-pill-subtle">EPSG:3857 / WGS84</span>
          <span className="footer-pill-subtle">ELEVATION: 18m – 32m MSL</span>
        </div>

        <div className="footer-right">
          <span>Cartography: © OpenStreetMap contributors · OpenFreeMap · MapLibre</span>
        </div>
      </div>

      <div className="footer-disclaimer-strip">
        <InfoIcon className="disclaimer-icon" />
        <p className="disclaimer-text">
          <strong>DEMONSTRATION PROTOTYPE:</strong> Sentinel Earth — FloodScope provides AI-assisted situational awareness and geospatial layer analytics. It is not an official flood warning service or certified disaster evacuation system. Follow Andhra Pradesh State Disaster Management Authority (APSDMA) and Central Water Commission (CWC) advisories for civil protection decisions.
        </p>
      </div>
    </footer>
  );
}
