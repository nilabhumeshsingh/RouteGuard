import React from "react";

export type CampusCategory =
  | "All"
  | "Classrooms"
  | "Washrooms"
  | "Exits"
  | "Stairs"
  | "Refuges"
  | "Help Points";

interface CategoryFilterChipsProps {
  selectedCategory: CampusCategory;
  onSelectCategory: (category: CampusCategory) => void;
}

const CATEGORIES: { id: CampusCategory; label: string; icon: string }[] = [
  { id: "All", label: "All", icon: "select_all" },
  { id: "Classrooms", label: "Classrooms", icon: "school" },
  { id: "Washrooms", label: "Washrooms", icon: "wc" },
  { id: "Exits", label: "Exits", icon: "exit_to_app" },
  { id: "Stairs", label: "Stairs", icon: "stairs" },
  { id: "Refuges", label: "Refuges", icon: "security" },
  { id: "Help Points", label: "Help Points", icon: "contact_support" }
];

export const CategoryFilterChips: React.FC<CategoryFilterChipsProps> = ({
  selectedCategory,
  onSelectCategory
}) => {
  return (
    <div className="w-full max-w-[520px] overflow-x-auto no-scrollbar py-1 flex items-center gap-2 select-none">
      {CATEGORIES.map((cat) => {
        const isSelected = selectedCategory === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`h-8 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-all duration-150 shrink-0 shadow-[0_1px_2px_rgba(60,64,67,0.12)] ${
              isSelected
                ? "bg-[#E8F0FE] text-[#1967D2] border-none font-semibold shadow-[0_1px_3px_rgba(25,103,210,0.25)]"
                : "bg-white text-[#5F6368] border border-[#DADCE0] hover:bg-[#F8F9FA] hover:text-[#202124]"
            }`}
          >
            <span className={`material-symbols-outlined text-[16px] ${isSelected ? "text-[#1967D2]" : "text-[#5F6368]"}`}>
              {cat.icon}
            </span>
            <span>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
};
