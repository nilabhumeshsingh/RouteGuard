import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, X, MapPin, Compass, ShieldAlert, Cpu, User, DoorOpen, Navigation } from "lucide-react";
import { RAW_POIS, POI } from "../../data/floor2Data";

interface TopSearchBarProps {
  onSelectDestination: (poi: POI) => void;
  selectedPOI: POI | null;
  onClearDestination?: () => void;
  isAlarmActive?: boolean;
}

export const TopSearchBar: React.FC<TopSearchBarProps> = ({
  onSelectDestination,
  selectedPOI,
  onClearDestination,
  isAlarmActive = false
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const categories = ["All", "Restrooms", "Exits", "Labs", "Faculty", "Classrooms"];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredPOIs = useMemo(() => {
    return RAW_POIS.filter((poi) => {
      if (selectedCategory === "Restrooms" && poi.category !== "Restroom") return false;
      if (selectedCategory === "Exits" && poi.category !== "Emergency Exit") return false;
      if (selectedCategory === "Labs" && !poi.category.includes("Lab")) return false;
      if (selectedCategory === "Faculty" && poi.category !== "Faculty Office") return false;
      if (selectedCategory === "Classrooms" && poi.category !== "Classroom" && poi.category !== "Seminar Room") return false;

      if (!query.trim()) return selectedCategory !== "All";
      const q = query.toLowerCase();
      const matchName = poi.name.toLowerCase().includes(q);
      const matchCategory = poi.category.toLowerCase().includes(q);
      const matchAlias = poi.aliases.some((a) => a.toLowerCase().includes(q));
      return matchName || matchCategory || matchAlias;
    });
  }, [selectedCategory, query]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Restroom":
        return <span className="text-[12px] font-bold text-[#34c759]">WC</span>;
      case "Emergency Exit":
        return <ShieldAlert className="w-4 h-4 text-[#ff3b30]" />;
      case "Faculty Office":
        return <User className="w-4 h-4 text-[#ff9500]" />;
      case "Computer Lab":
      case "Research Lab":
        return <Cpu className="w-4 h-4 text-[#0066cc]" />;
      case "Elevator":
      case "Stairs":
        return <Compass className="w-4 h-4 text-[#86868b]" />;
      default:
        return <DoorOpen className="w-4 h-4 text-[#1d1d1f]" />;
    }
  };

  const handleSelect = (poi: POI) => {
    onSelectDestination(poi);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div
      ref={containerRef}
      className={`fixed left-4 right-4 sm:left-6 sm:right-auto sm:w-[420px] z-30 transition-all duration-300 ${
        isAlarmActive ? "top-32" : "top-14"
      }`}
    >
      {/* Floating Pill Card */}
      <div className="bg-white/90 backdrop-blur-xl border border-black/10 rounded-2xl shadow-floating p-2 space-y-2">
        {selectedPOI && !isOpen ? (
          /* Active Destination Display */
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0066cc]/10 border border-[#0066cc]/20 rounded-xl">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#0066cc] flex items-center justify-center text-white shrink-0 shadow-sm">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0066cc]">
                  Navigating To
                </p>
                <p className="text-[13px] font-bold text-[#1d1d1f] truncate">
                  {selectedPOI.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  setIsOpen(true);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="px-2.5 py-1 text-xs font-semibold text-[#0066cc] hover:bg-[#0066cc]/10 rounded-lg transition-colors"
              >
                Change
              </button>
              {onClearDestination && (
                <button
                  onClick={onClearDestination}
                  title="Clear destination"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Search Input Box */
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-[#86868b] pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="Search rooms, labs, exits, restrooms..."
              className="w-full h-10 pl-9 pr-8 rounded-xl bg-[#e3e3e8]/60 focus:bg-white text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] border border-transparent focus:border-[#0071e3] focus:outline-none transition-all shadow-inner"
            />
            {query ? (
              <button
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="absolute right-2.5 w-5 h-5 rounded-full bg-black/10 flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f]"
              >
                <X className="w-3 h-3" />
              </button>
            ) : null}
          </div>
        )}

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  if (isSelected && cat !== "All") {
                    setSelectedCategory("All");
                  } else {
                    setSelectedCategory(cat);
                    setIsOpen(true);
                  }
                }}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all active:scale-95 whitespace-nowrap ${
                  isSelected
                    ? "bg-[#1d1d1f] text-white shadow-sm"
                    : "bg-[#e3e3e8]/70 hover:bg-[#e3e3e8] text-[#1d1d1f]"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Autocomplete Dropdown Panel */}
      {isOpen && (
        <div className="mt-2 bg-white/95 backdrop-blur-2xl border border-black/10 rounded-2xl shadow-2xl p-2 space-y-1 max-h-[55vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-2 py-1 flex items-center justify-between border-b border-black/5">
            <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">
              {query ? `Matches for "${query}"` : `${selectedCategory} Destinations`}
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[11px] text-[#0066cc] font-medium hover:underline"
            >
              Close
            </button>
          </div>

          {filteredPOIs.length === 0 ? (
            <div className="text-center py-6 text-[#86868b] text-[13px]">
              {query
                ? `No places found matching "${query}"`
                : "Select a category above or type to search"}
            </div>
          ) : (
            filteredPOIs.map((poi) => (
              <div
                key={poi.id}
                onClick={() => handleSelect(poi)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#f2f2f7] active:bg-[#e5e5ea] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-black/5 group-hover:bg-white flex items-center justify-center shrink-0 transition-colors">
                    {getCategoryIcon(poi.category)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-semibold text-[#1d1d1f] flex items-center gap-1.5 truncate">
                      {poi.name}
                      {poi.category === "Emergency Exit" && (
                        <span className="text-[9px] bg-[#34c759]/15 text-[#248a3d] font-bold px-1.5 py-0.5 rounded shrink-0">
                          SAFE EXIT
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-[#86868b] truncate">
                      {poi.category} • 2nd Floor
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[#0066cc] text-[12px] font-semibold pl-2 shrink-0">
                  <span>Go</span>
                  <Navigation className="w-3 h-3" />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
