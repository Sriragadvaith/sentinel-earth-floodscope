import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  X,
  MapPin,
  HeartPulse,
  Home,
  Shield,
  Droplet,
  Navigation,
  AlertTriangle,
  Activity,
} from "lucide-react";
import type { AppGeoFeature, LayerCategory } from "../../types/geo";

interface SpatialSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  features: AppGeoFeature[];
  onSelectFeature: (feature: AppGeoFeature) => void;
}

export function SpatialSearchModal({
  isOpen,
  onClose,
  features,
  onSelectFeature,
}: SpatialSearchModalProps) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        setSelectedIndex(0);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return features.filter((f) => {
      const p = f.properties;
      const matchesCat = categoryFilter === "all" || p.category === categoryFilter;
      if (!matchesCat) return false;
      if (!q) return true;

      const name = (p.name || "").toLowerCase();
      const nameTe = (p.name_te || "").toLowerCase();
      const type = (p.type || "").toLowerCase();
      const desc = (p.description || "").toLowerCase();

      return name.includes(q) || nameTe.includes(q) || type.includes(q) || desc.includes(q);
    });
  }, [features, query, categoryFilter]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      onSelectFeature(filtered[selectedIndex]);
      handleClose();
    }
  };

  if (!isOpen) return null;

  const getCatIcon = (category: LayerCategory) => {
    switch (category) {
      case "river":
        return Droplet;
      case "floodZones":
        return AlertTriangle;
      case "hospitals":
        return HeartPulse;
      case "shelters":
        return Home;
      case "emergencyServices":
        return Shield;
      case "roads":
        return Navigation;
      case "riverGauges":
      case "rainfallStations":
        return Activity;
      default:
        return MapPin;
    }
  };

  return (
    <div className="spatial-search-backdrop" onClick={handleClose} role="dialog" aria-modal="true">
      <div
        className="spatial-search-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="search-input-row">
          <Search size={18} className="search-lead-icon" />
          <input
            ref={inputRef}
            type="text"
            className="spatial-search-input"
            placeholder="Search Vijayawada wards, flood zones, hospitals, shelters, barrages..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            aria-label="Spatial search query"
          />
          {query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setQuery("")}
              aria-label="Clear search query"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="esc-hint">ESC</kbd>
        </div>

        {/* Category Filter Chips */}
        <div className="filter-chips-row">
          {[
            { id: "all", label: "All Assets" },
            { id: "floodZones", label: "Flood Zones" },
            { id: "hospitals", label: "Hospitals" },
            { id: "shelters", label: "Shelters" },
            { id: "riverGauges", label: "River Gauges" },
            { id: "emergencyServices", label: "Emergency Posts" },
            { id: "river", label: "Waterways" },
            { id: "roads", label: "Evacuation Roads" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`filter-chip ${categoryFilter === cat.id ? "active" : ""}`}
              onClick={() => {
                setCategoryFilter(cat.id);
                setSelectedIndex(0);
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Results List */}
        <div className="search-results-list" role="listbox">
          {filtered.length === 0 ? (
            <div className="no-results-box">
              <p>No matching features found for "{query}".</p>
              <span className="no-results-hint">
                Try searching for "Prakasam", "Krishna Lanka", "GGH", "Azariah", or "Budameru".
              </span>
            </div>
          ) : (
            filtered.map((f, idx) => {
              const p = f.properties;
              const Icon = getCatIcon(p.category);
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={p.id || idx}
                  role="option"
                  aria-selected={isSelected}
                  className={`search-result-item ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    onSelectFeature(f);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <Icon size={16} className={`cat-icon cat-${p.category}`} />
                  <div className="result-text-block">
                    <div className="result-name-row">
                      <span className="result-name">{p.name || p.type}</span>
                      {p.riskLevel && (
                        <span className={`risk-tag risk-${p.riskLevel}`}>
                          {p.riskLevel.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {p.name_te && <div className="result-telugu">{p.name_te}</div>}
                    <div className="result-meta-row">
                      <span className="result-type">{p.type || p.category}</span>
                      {p.elevationApproxM && (
                        <span>· {p.elevationApproxM}m MSL</span>
                      )}
                      {p.capacity && (
                        <span>· {p.capacity.toLocaleString()} cap</span>
                      )}
                      {p.beds && (
                        <span>· {p.beds} beds</span>
                      )}
                    </div>
                  </div>
                  <span className="action-hint">Fly To</span>
                </div>
              );
            })
          )}
        </div>

        <div className="modal-footer">
          <span>{filtered.length} features indexed</span>
          <span>Use ↑ ↓ to navigate · Enter to select</span>
        </div>
      </div>
    </div>
  );
}
