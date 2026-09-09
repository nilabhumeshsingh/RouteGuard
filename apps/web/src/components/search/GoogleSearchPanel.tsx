import React from "react";
import { ARCHITECTURAL_ROOMS, ArchitecturalRoom, POI } from "../../data/floor2Data";

interface GoogleSearchPanelProps {
  isOpen: boolean;
  query: string;
  onClose: () => void;
  onSelectPOI: (poi: POI) => void;
  categoryFilter?: string;
}

export const GoogleSearchPanel: React.FC<GoogleSearchPanelProps> = ({
  isOpen,
  query,
  onClose,
  onSelectPOI,
  categoryFilter = "All"
}) => {
  if (!isOpen) return null;

  const hasCategoryFilter = categoryFilter !== "All";

  const recentPOIs: POI[] = [
    {
      id: "poi-204",
      name: "Room 204 (Lecture Room)",
      category: "Classroom",
      nodeId: "node-204",
      aliases: ["204", "lecture"]
    },
    {
      id: "poi-219",
      name: "Room 219 (AI & Robotics Lab)",
      category: "Classroom",
      nodeId: "node-219",
      aliases: ["219", "ai lab"]
    },
    {
      id: "poi-stair-nw",
      name: "Stairs & Lift NW (Fire Egress)",
      category: "Emergency Exit",
      nodeId: "exit-west",
      aliases: ["stairs", "northwest exit", "lift nw"]
    },
    {
      id: "poi-wash-nw",
      name: "Male Washroom (Northwest)",
      category: "Restroom",
      nodeId: "node-201",
      aliases: ["washroom", "restroom", "toilet"]
    }
  ];

  // Filter architectural rooms based on query and category
  const filteredRooms = ARCHITECTURAL_ROOMS.filter((room) => {
    const matchesQuery =
      !query ||
      room.name.toLowerCase().includes(query.toLowerCase()) ||
      room.code.toLowerCase().includes(query.toLowerCase()) ||
      room.category.toLowerCase().includes(query.toLowerCase());

    const cat = categoryFilter.toLowerCase();
    let matchesCat = true;
    if (cat === "classrooms") matchesCat = room.category === "classroom" || room.category === "lab";
    else if (cat === "washrooms") matchesCat = room.category === "restroom";
    else if (cat === "stairs") matchesCat = room.category === "service" || room.id.includes("stair");
    else if (cat === "exits") matchesCat = room.category === "service" || room.id.includes("stair") || room.category === "terrace";
    else if (cat === "refuges") matchesCat = room.category === "service" || room.category === "terrace";
    else if (cat === "help points") matchesCat = room.category === "office" || room.category === "service";

    return matchesQuery && matchesCat;
  });

  return (
    <div className="absolute top-[60px] md:top-[64px] left-0 right-0 md:left-0 md:w-[460px] bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.18)] border border-[#DADCE0] p-3.5 z-40 max-h-[75vh] flex flex-col select-none overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E8EAED]">
        <span className="text-xs font-semibold text-[#5F6368] uppercase tracking-wider">
          {query
            ? `Search Results (${filteredRooms.length})`
            : hasCategoryFilter
            ? `${categoryFilter} (${filteredRooms.length})`
            : "Recent Destinations & Spaces"}
        </span>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#5F6368] hover:bg-[#F1F3F4] transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
        {!query && !hasCategoryFilter && (
          <div className="mb-3">
            <div className="text-[11px] font-medium text-[#5F6368] px-2 mb-1">Recent Searches</div>
            {recentPOIs.map((poi) => (
              <button
                key={poi.id}
                onClick={() => {
                  onSelectPOI(poi);
                  onClose();
                }}
                className="w-full px-3 py-2 rounded-xl flex items-center gap-3 text-left hover:bg-[#F8F9FA] transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-[#F1F3F4] group-hover:bg-[#E8F0FE] flex items-center justify-center text-[#5F6368] group-hover:text-[#1A73E8] transition-colors">
                  <span className="material-symbols-outlined text-[18px]">history</span>
                </div>
                <div className="flex-1 truncate">
                  <div className="text-sm font-medium text-[#202124] truncate">{poi.name}</div>
                  <div className="text-xs text-[#5F6368]">{poi.category} · Floor 2</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {filteredRooms.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#5F6368]">
            No matching rooms or services found.
          </div>
        ) : (
          filteredRooms.map((r) => {
            const poi: POI = {
              id: `poi-${r.code}`,
              name: r.name,
              category: r.category,
              nodeId: r.nodeId,
              aliases: [r.code, r.name]
            };

            const iconMap: Record<string, string> = {
              classroom: "school",
              lab: "precision_manufacturing",
              office: "meeting_room",
              restroom: "wc",
              service: "stairs",
              terrace: "deck"
            };

            return (
              <button
                key={r.id}
                onClick={() => {
                  onSelectPOI(poi);
                  onClose();
                }}
                className="w-full px-3 py-2 rounded-xl flex items-center gap-3 text-left hover:bg-[#F8F9FA] transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-[#F1F3F4] group-hover:bg-[#E8F0FE] flex items-center justify-center text-[#5F6368] group-hover:text-[#1A73E8] transition-colors">
                  <span className="material-symbols-outlined text-[18px]">
                    {iconMap[r.category] || "place"}
                  </span>
                </div>
                <div className="flex-1 truncate">
                  <div className="text-sm font-medium text-[#202124] truncate">{r.name}</div>
                  <div className="text-xs text-[#5F6368] flex items-center gap-1.5">
                    <span>{r.category}</span>
                    <span>·</span>
                    <span>{r.wing}</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[16px] text-[#DADCE0] group-hover:text-[#1A73E8] transition-colors">
                  north_east
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
