import React, { useState, useMemo } from "react";
import { Search, MapPin, Compass, ShieldAlert, Cpu, User, DoorOpen, Sparkles, Navigation } from "lucide-react";
import { RAW_POIS, POI } from "../../data/floor2Data";

interface SearchSheetProps {
  onSelectDestination: (poi: POI) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const SearchSheet: React.FC<SearchSheetProps> = ({
  onSelectDestination,
  searchQuery,
  onSearchChange
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", "Restrooms", "Exits", "Labs", "Faculty", "Classrooms"];

  const filteredPOIs = useMemo(() => {
    return RAW_POIS.filter((poi) => {
      // Category filter
      if (selectedCategory === "Restrooms" && poi.category !== "Restroom") return false;
      if (selectedCategory === "Exits" && poi.category !== "Emergency Exit") return false;
      if (selectedCategory === "Labs" && !poi.category.includes("Lab")) return false;
      if (selectedCategory === "Faculty" && poi.category !== "Faculty Office") return false;
      if (selectedCategory === "Classrooms" && poi.category !== "Classroom" && poi.category !== "Seminar Room") return false;

      // Query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = poi.name.toLowerCase().includes(q);
      const matchCategory = poi.category.toLowerCase().includes(q);
      const matchAlias = poi.aliases.some((a) => a.toLowerCase().includes(q));
      return matchName || matchCategory || matchAlias;
    });
  }, [selectedCategory, searchQuery]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Restroom":
        return <span className="text-[13px] font-bold text-[#34c759]">WC</span>;
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

  return (
    <div className="space-y-3.5">
      {/* Search Input Box (Apple Pill) */}
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 w-4 h-4 text-[#86868b] pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search rooms, labs, exits, restrooms..."
          className="w-full h-11 pl-10 pr-4 rounded-full bg-[#e3e3e8]/60 focus:bg-white text-[15px] text-[#1d1d1f] placeholder:text-[#86868b] border border-transparent focus:border-[#0071e3] focus:outline-none transition-all shadow-inner"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3.5 text-xs text-[#86868b] hover:text-[#1d1d1f] bg-black/5 rounded-full px-2 py-0.5"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all active:scale-95 whitespace-nowrap ${
                isSelected
                  ? "bg-[#1d1d1f] text-white shadow-sm"
                  : "bg-white border border-black/8 text-[#1d1d1f] hover:bg-black/5"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Autocomplete Results List */}
      <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pt-1">
        {filteredPOIs.length === 0 ? (
          <div className="text-center py-8 text-[#86868b] text-[14px]">
            No destinations found matching "{searchQuery}"
          </div>
        ) : (
          filteredPOIs.map((poi) => (
            <div
              key={poi.id}
              onClick={() => onSelectDestination(poi)}
              className="flex items-center justify-between p-3 rounded-[14px] bg-white hover:bg-[#f2f2f7] border border-black/5 active:scale-[0.99] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center">
                  {getCategoryIcon(poi.category)}
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                    {poi.name}
                    {poi.category === "Emergency Exit" && (
                      <span className="text-[10px] bg-[#34c759]/15 text-[#248a3d] font-bold px-1.5 py-0.5 rounded-md">
                        SAFE EXIT
                      </span>
                    )}
                  </h4>
                  <p className="text-[12px] text-[#86868b]">
                    {poi.category} • 2nd Floor
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[#0066cc] text-[13px] font-semibold">
                <span>Navigate</span>
                <Navigation className="w-3.5 h-3.5" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
