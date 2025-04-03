// React and hooks imports
import React, { useState } from "react";

// Third-party component imports
import { ChevronsUpDown, ListFilter, Trash, X } from "lucide-react";

// Local UI component imports
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Utility imports
import { cn } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { AssetData } from "@/types";
import { parseAssetData } from "@/utils/assetUtils";
import { Button } from "./ui/button";

/**
 * Base interface for option items in the multi-select combobox
 * @property label - Display text for the option
 * @property value - Unique identifier for the option
 */
export interface BaseOption {
  label: string;
  value: string;
}

/**
 * Generic type for extending BaseOption with additional properties
 */
export type Option<T extends BaseOption = BaseOption> = T;

/**
 * Props interface for the MultiSelectCombobox component
 * @template T - Type extending BaseOption
 */
interface Props<T extends BaseOption> {
  /** Label for the combobox */
  label: string;
  /** Custom render function for individual options */
  renderItem: (option: T) => React.ReactNode;
  /** Custom render function for selected items display */
  renderSelectedItem: (value: string[]) => React.ReactNode;
  /** Array of available options */
  options: T[];
  /** Array of selected values */
  value: string[];
  /** Optional placeholder text for search input */
  placeholder?: string;
  assetsData: AssetData[];
  /** Callback function when selection changes */
  setAssetsData: (value: React.SetStateAction<AssetData[]>) => void;
}

/**
 * A customizable multi-select combobox component with type safety
 * @template T - Type extending BaseOption
 */
export const AssetPicker = <T extends BaseOption>({
  label,
  renderItem,
  renderSelectedItem,
  options,
  value,
  placeholder,
  assetsData,
  setAssetsData,
}: Props<T>) => {
  // State for controlling popover visibility
  const [open, setOpen] = useState(false);

  /**
   * Handles the selection/deselection of an option
   */
  const handleChange = (currentValue: string) => {
    const toRemove = assetsData.find((a) => a.symbol === currentValue);
    if (toRemove) {
      setAssetsData((prev) => prev.filter((a) => a.symbol !== currentValue));
    }
  };

  /**
   * Clears all selected values
   */
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAssetsData([]);
  };

  const [searchedAsset, setSearchedAsset] = useState<AssetData | undefined>(
    undefined,
  );
  const [loadingTicks, setLoadingTicks] = useState(false);

  const searchSymbol = async (search: string) => {
    if (
      // we cannot find the search input inside the assetsData
      !options.find((a) => a.value === search || a.value.includes(search)) &&
      // the search input is a valid symbol
      search.indexOf("1r") === 0 &&
      search.length >= 5
    ) {
      setLoadingTicks(true);
      const ticks = await invoke("get_ticks", { symbol: search, length: 30 });
      setSearchedAsset(parseAssetData(ticks, 0));
      setLoadingTicks(false);
    }
  };

  const addAsset = async () => {
    if (searchedAsset) {
      setAssetsData((prev) => [...prev, searchedAsset]);
      setSearchedAsset(undefined);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls="multi-select-options"
          aria-label={`Select ${label}`}
          tabIndex={0}
          className="flex h-10 min-w-[200px] cursor-pointer items-center justify-start gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setOpen(!open);
            }
          }}
        >
          {/* Icon and label section */}
          <ListFilter
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          {value.length > 0 && (
            <span className="text-muted-foreground">{label}</span>
          )}

          {/* Selected items display */}
          <div className="flex-1 overflow-hidden">
            {value.length > 0
              ? renderSelectedItem(value)
              : `Select ${label}...`}
          </div>

          {/* Control buttons */}
          <span className="z-10 ml-auto flex items-center gap-2">
            {value.length > 0 && (
              <button
                type="button"
                aria-label="Clear selection"
                className="z-10 rounded-sm opacity-50 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
                onClick={handleClear}
              >
                <X className="size-4 shrink-0" />
              </button>
            )}
            <ChevronsUpDown
              className="size-4 shrink-0 opacity-50"
              aria-hidden="true"
            />
          </span>
        </div>
      </PopoverTrigger>

      {/* Dropdown content */}
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        id="multi-select-options"
      >
        <Command>
          <CommandInput
            placeholder={placeholder || `Search ${label}...`}
            aria-label={`Search ${label}`}
            onValueChange={searchSymbol}
          />
          <CommandList>
            <CommandEmpty>
              {loadingTicks ? "Loading..." : ""}
              {searchedAsset ? (
                <>
                  Add {searchedAsset.name} ({searchedAsset.symbol})
                  <Button onClick={addAsset} className="w-full">
                    Yes
                  </Button>
                </>
              ) : (
                ""
              )}
              No {label} found.
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleChange(option.value)}
                  aria-selected={value.includes(option.value)}
                  className="flex items-center justify-between"
                >
                  {renderItem(option)}
                  <Trash
                    className={cn(
                      "ml-2 h-4 w-4",
                      value.includes(option.value)
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                    aria-hidden="true"
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
