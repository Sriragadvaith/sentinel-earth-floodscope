import { useState, useEffect, useRef, useMemo } from "react";
import { Search, MapPin, Eye, RotateCcw, Compass, Layers, X, ShieldAlert, Sparkles } from "lucide-react";
import type { LayerCategory, LayerConfig } from "../types/geo";
import { Portal } from "./Portal";

export interface CommandItem {
  id: string;
  category: "Places" | "Layers" | "View Actions" | "Scenarios";
  title: string;
  subtitle: string;
  icon: typeof Search;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  layers: LayerConfig[];
  onToggleLayer: (layerId: LayerCategory) => void;
  onFlyToLocation: (center: [number, number], zoom: number) => void;
  onResetView: () => void;
  onToggleBasemap: () => void;
  onToggle3DTilt: () => void;
  onSelectTab: (tab: string) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  layers,
  onToggleLayer,
  onFlyToLocation,
  onResetView,
  onToggleBasemap,
  onToggle3DTilt,
  onSelectTab,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => {
        setQuery("");
        setSelectedIndex(0);
      });
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Construct items list based on real project data & actions
  const allCommands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      // Quick View Actions
      {
        id: "action-reset-north",
        category: "View Actions",
        title: "Reset Map View (True North)",
        subtitle: "Align bearing to 0° and center on Vijayawada urban basin",
        icon: RotateCcw,
        action: () => {
          onResetView();
          onClose();
        },
        keywords: ["north", "center", "recenter", "reset"],
      },
      {
        id: "action-toggle-3d",
        category: "View Actions",
        title: "Toggle 3D Perspective Tilt",
        subtitle: "Switch between 55° isometric angle and 2D nadir view",
        icon: Compass,
        action: () => {
          onToggle3DTilt();
          onClose();
        },
        keywords: ["pitch", "tilt", "3d", "angle", "isometric"],
      },
      {
        id: "action-toggle-basemap",
        category: "View Actions",
        title: "Toggle Basemap (Dark Tactical / Liberty)",
        subtitle: "Switch between high-contrast tactical and detailed OpenFreeMap tiles",
        icon: Layers,
        action: () => {
          onToggleBasemap();
          onClose();
        },
        keywords: ["style", "satellite", "dark", "liberty", "tiles"],
      },
      {
        id: "action-view-3d-hero",
        category: "View Actions",
        title: "Open Cinematic 3D Relief Hero",
        subtitle: "Explore the SRTM topographic model of the Krishna gorge",
        icon: Compass,
        action: () => {
          onSelectTab("terrain3d");
          onClose();
        },
        keywords: ["hero", "terrain", "relief", "srtm", "3d"],
      },
      {
        id: "action-view-scenarios",
        category: "Scenarios",
        title: "Open Hydrological Scenario Matrix",
        subtitle: "Simulate Krishna River discharge, 24h rainfall, and barrage breach",
        icon: ShieldAlert,
        action: () => {
          onSelectTab("rainfall");
          onClose();
        },
        keywords: ["discharge", "cusecs", "flood", "michaung", "rainfall"],
      },
      {
        id: "action-view-planner",
        category: "Scenarios",
        title: "Open Nebius AI Emergency Response Planner",
        subtitle: "Grounded crisis contingency briefing and infrastructure actions",
        icon: Sparkles,
        action: () => {
          onSelectTab("nemotron");
          onClose();
        },
        keywords: ["ai", "planner", "emergency", "nebius", "nemotron", "response"],
      },

      // Sector Bookmarks (Real Vijayawada Locations)
      {
        id: "place-prakasam-barrage",
        category: "Places",
        title: "Prakasam Barrage (Gate Infrastructure)",
        subtitle: "Critical Krishna outflow regulator · 80.6050°E, 16.5075°N",
        icon: MapPin,
        action: () => {
          onFlyToLocation([80.605, 16.5075], 14.8);
          onClose();
        },
        keywords: ["barrage", "prakasam", "dam", "gates", "krishna"],
      },
      {
        id: "place-kanaka-durga",
        category: "Places",
        title: "Indrakeeladri Hill & Kanaka Durga",
        subtitle: "High elevation rocky promontory · 80.6120°E, 16.5165°N",
        icon: MapPin,
        action: () => {
          onFlyToLocation([80.612, 16.5165], 15.2);
          onClose();
        },
        keywords: ["temple", "indrakeeladri", "kanaka", "hill", "durga"],
      },
      {
        id: "place-krishna-lanka",
        category: "Places",
        title: "Krishna Lanka Low-Lying Ward",
        subtitle: "High vulnerability riverfront floodplain · 80.6380°E, 16.5015°N",
        icon: MapPin,
        action: () => {
          onFlyToLocation([80.638, 16.5015], 14.5);
          onClose();
        },
        keywords: ["lanka", "vulnerable", "floodplain", "ward", "residential"],
      },
      {
        id: "place-bhavani-island",
        category: "Places",
        title: "Bhavani Island Riverine Park",
        subtitle: "Major upstream Krishna River island · 80.5750°E, 16.5180°N",
        icon: MapPin,
        action: () => {
          onFlyToLocation([80.575, 16.518], 14.2);
          onClose();
        },
        keywords: ["bhavani", "island", "riverbed", "upstream"],
      },
      {
        id: "place-ggh-hospital",
        category: "Places",
        title: "Government General Hospital (GGH)",
        subtitle: "Primary regional trauma center · 80.6385°E, 16.5175°N",
        icon: MapPin,
        action: () => {
          onFlyToLocation([80.6385, 16.5175], 15.0);
          onClose();
        },
        keywords: ["hospital", "ggh", "medical", "trauma", "emergency"],
      },
      {
        id: "place-varadhi-bridge",
        category: "Places",
        title: "Kanaka Durga Varadhi Bridge (NH16)",
        subtitle: "Primary evacuation corridor across Krishna · 80.6280°E, 16.4950°N",
        icon: MapPin,
        action: () => {
          onFlyToLocation([80.628, 16.495], 14.4);
          onClose();
        },
        keywords: ["bridge", "varadhi", "nh16", "highway", "evacuation"],
      },
    ];

    // Add Layer Toggles
    for (const lyr of layers) {
      items.push({
        id: `layer-${lyr.id}`,
        category: "Layers",
        title: `Toggle ${lyr.label}`,
        subtitle: `${lyr.visible ? "Currently Active (Click to Hide)" : "Currently Hidden (Click to Show)"} · ${lyr.count} features`,
        icon: Eye,
        action: () => {
          onToggleLayer(lyr.id);
          onClose();
        },
        keywords: [lyr.id, lyr.label.toLowerCase(), "layer", "toggle"],
      });
    }

    return items;
  }, [layers, onFlyToLocation, onResetView, onToggle3DTilt, onToggleBasemap, onToggleLayer, onSelectTab, onClose]);

  // Filter items matching query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase().trim();
    return allCommands.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSubtitle = item.subtitle.toLowerCase().includes(q);
      const matchCategory = item.category.toLowerCase().includes(q);
      const matchKeywords = item.keywords?.some((k) => k.includes(q)) ?? false;
      return matchTitle || matchSubtitle || matchCategory || matchKeywords;
    });
  }, [allCommands, query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="command-palette-backdrop" onClick={onClose} role="presentation">
        <div
          className="command-palette-dialog glass-surface--floating"
          role="dialog"
          aria-modal="true"
          aria-label="Sentinel Command Palette"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cockpit L-Brackets */}
          <span className="hud-corner corner-tl" />
          <span className="hud-corner corner-tr" />
          <span className="hud-corner corner-bl" />
          <span className="hud-corner corner-br" />

          <div className="palette-input-row">
            <Search className="palette-search-icon" size={17} strokeWidth={1.75} />
            <input
              ref={inputRef}
              type="text"
              className="palette-input"
              placeholder="Type a command, layer, or Vijayawada location..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
            />
            <button type="button" className="palette-close-btn glass-icon-btn" onClick={onClose} aria-label="Close Command Palette">
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>

          <div className="palette-list" ref={listRef} role="listbox">
            {filteredCommands.length === 0 ? (
              <div className="palette-empty-state">
                <span>No matching commands or locations found</span>
              </div>
            ) : (
              filteredCommands.map((item, index) => {
                const isSelected = index === selectedIndex;
                const IconComp = item.icon;
                return (
                  <div
                    key={item.id}
                    className={`palette-item glass-nav-item ${isSelected ? "selected is-active" : ""}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => item.action()}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="palette-item-icon">
                      <IconComp size={16} strokeWidth={1.75} />
                    </div>
                    <div className="palette-item-text">
                      <div className="palette-item-title-row">
                        <span className="palette-item-title">{item.title}</span>
                        <span className="palette-item-cat">{item.category}</span>
                      </div>
                      <span className="palette-item-subtitle">{item.subtitle}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="palette-footer-row">
            <div className="palette-key-hints">
              <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span><kbd>↵</kbd> select</span>
              <span><kbd>esc</kbd> close</span>
            </div>
            <span className="palette-badge">SENTINEL EARTH COMMAND</span>
          </div>
        </div>
      </div>
    </Portal>
  );
}
