import {
  Clock,
  Activity,
  Droplet,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  VIJAYAWADA_FLOOD_EPOCHS,
  type FloodHistoricalEpoch,
} from "../../data/disasterResponseData";

interface TemporalTimelineBarProps {
  currentEpochId: string;
  onSelectEpoch: (epoch: FloodHistoricalEpoch) => void;
  onClose: () => void;
}

export function TemporalTimelineBar({
  currentEpochId,
  onSelectEpoch,
  onClose,
}: TemporalTimelineBarProps) {
  const selectedEpoch =
    VIJAYAWADA_FLOOD_EPOCHS.find((e) => e.id === currentEpochId) ||
    VIJAYAWADA_FLOOD_EPOCHS[0];

  const maxDischarge = 1200000; // 1.2M cfs max reference
  const dischargePercent = Math.min(
    100,
    Math.round((selectedEpoch.prakasamDischargeCfs / maxDischarge) * 100)
  );

  return (
    <div className="temporal-timeline-dock" role="region" aria-label="Temporal Flood Intelligence">
      <div className="timeline-dock-header">
        <div className="timeline-badge-group">
          <Clock size={15} className="timeline-clock-icon" />
          <span className="dock-title">TEMPORAL FLOOD INTELLIGENCE & HYDROLOGICAL TIMELINE</span>
          <span className={`prov-tag prov-${selectedEpoch.provenance.toLowerCase()}`}>
            {selectedEpoch.provenance} DATA
          </span>
        </div>
        <button
          type="button"
          className="dock-close-btn"
          onClick={onClose}
          aria-label="Close Temporal Timeline"
        >
          <X size={15} />
        </button>
      </div>

      <div className="timeline-dock-body">
        {/* Epoch Selector Buttons */}
        <div className="epochs-nav-track">
          {VIJAYAWADA_FLOOD_EPOCHS.map((epoch) => {
            const isSelected = epoch.id === selectedEpoch.id;
            return (
              <button
                key={epoch.id}
                type="button"
                className={`epoch-tab-btn ${isSelected ? "selected" : ""}`}
                onClick={() => onSelectEpoch(epoch)}
              >
                <div className="epoch-header-line">
                  <span className={`epoch-dot dot-${epoch.severity.toLowerCase()}`} />
                  <span className="epoch-name">{epoch.name}</span>
                </div>
                <div className="epoch-sub-line">
                  <span className="epoch-date">{epoch.dateLabel}</span>
                  <span className="epoch-cfs tabular-num">
                    {(epoch.prakasamDischargeCfs / 1000).toLocaleString()}k cfs
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Epoch Hydrograph Telemetry Bar */}
        <div className="epoch-metrics-strip">
          <div className="metric-chip discharge-chip">
            <span className="chip-label">
              <Activity size={12} /> PRAKASAM BARRAGE DISCHARGE
            </span>
            <div className="chip-val-row">
              <span className="chip-val tabular-num">
                {selectedEpoch.prakasamDischargeCfs.toLocaleString()} cfs
              </span>
              <span className="chip-badge">{selectedEpoch.gatesOpen}</span>
            </div>
            {/* Visual Gauge Bar */}
            <div className="gauge-progress-track">
              <div
                className={`gauge-progress-fill fill-${selectedEpoch.severity.toLowerCase()}`}
                style={{ width: `${dischargePercent}%` }}
              />
            </div>
          </div>

          <div className="metric-chip stage-chip">
            <span className="chip-label">
              <Droplet size={12} /> BARRAGE CREST WATER LEVEL
            </span>
            <span className="chip-val tabular-num">
              {selectedEpoch.waterLevelFt.toFixed(1)} ft (Warning: 14.5 ft · Danger: 17.0 ft)
            </span>
            <span className="chip-sub">
              24-Hour Basin Rainfall: {selectedEpoch.rainfall24hMm} mm
            </span>
          </div>

          <div className="metric-chip impact-chip">
            <span className="chip-label">
              <ShieldAlert size={12} /> RECORDED DISASTER IMPACT
            </span>
            <span className="chip-val">{selectedEpoch.affectedPopulationEstimate}</span>
            <span className="chip-sub">{selectedEpoch.description}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
